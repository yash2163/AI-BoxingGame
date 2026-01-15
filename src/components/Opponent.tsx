import React, { useEffect, useRef, useState } from 'react';
import { useAnimations } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LoopOnce, LoopRepeat } from 'three';
import gsap from 'gsap';
import { useBoxingAssets } from '../hooks/useBoxingAssets'; // Import new hook

interface Punch {
    id: string;
    side: 'left' | 'right';
    type: 'straight' | 'hook';
    startTime: number;
    duration: number;
    status: 'flying' | 'hit' | 'dodged';
}

interface OpponentProps {
    activePunch: Punch | null;
    speedMultiplier: number;
    showDebug?: boolean; // Toggle to see hitboxes
}

export function Opponent({ activePunch, speedMultiplier, showDebug = false }: OpponentProps) {
    const group = useRef<THREE.Group>(null);
    const { scene, animations } = useBoxingAssets(); // Optimized Load
    const { actions } = useAnimations(animations, group);
    const { camera } = useThree();

    const currentAction = useRef<THREE.AnimationAction | null>(null);
    const [debugColor, setDebugColor] = useState('#00ff00'); // Green = Safe, Red = Active Hit Window

    // --- SETUP IDLE ---
    useEffect(() => {
        const idle = actions['Idle'];
        if (idle) {
            idle.setLoop(LoopRepeat, Infinity);
            idle.reset().fadeIn(0.5).play();
            currentAction.current = idle;
        }
    }, [actions]);

    // --- PUNCH LOGIC ---
    useEffect(() => {
        if (!activePunch) return;

        const actionName = activePunch.type === 'hook'
            ? activePunch.side === 'left' ? 'LeftHook' : 'RightHook'
            : activePunch.side === 'left' ? 'LeftStraight' : 'RightStraight';

        const punch = actions[actionName];
        const idle = actions['Idle'];

        if (!punch || !idle) return;

        // 1. Calculate Speed
        const clipDuration = punch.getClip().duration;
        let appliedTimeScale = speedMultiplier;

        if (activePunch.duration > 0) {
            const gameDurationSec = activePunch.duration / 1000;
            appliedTimeScale = clipDuration / gameDurationSec;
            // Clamp to sane limits (0.5x to 3.0x)
            appliedTimeScale = THREE.MathUtils.clamp(appliedTimeScale, 0.5, 3.0);
        }

        punch.timeScale = appliedTimeScale;

        // 2. Play Animation
        const previous = currentAction.current || idle;
        previous.fadeOut(0.15); // Fast blend for snap

        punch.reset().setLoop(LoopOnce, 1);
        punch.clampWhenFinished = true;
        punch.fadeIn(0.15).play();
        currentAction.current = punch;

        // 3. Camera Impact (Juice)
        // const initialZ = 2.2;
        // gsap.killTweensOf(camera.position);
        // gsap.to(camera.position, {
        //     z: initialZ - 0.4,
        //     duration: 0.2,
        //     ease: "power2.out"
        // });

        // 4. Return to Idle
        const cleanupTime = activePunch.duration > 0
            ? activePunch.duration
            : (clipDuration / appliedTimeScale) * 1000;

        const timer = setTimeout(() => {
            punch.fadeOut(0.3);
            idle.reset().fadeIn(0.3).play();
            currentAction.current = idle;

            // gsap.to(camera.position, {
            //     z: initialZ,
            //     duration: 0.5,
            //     ease: "elastic.out(1, 0.75)"
            // });
        }, cleanupTime);

        return () => clearTimeout(timer);

    }, [activePunch?.id, actions, camera, speedMultiplier]);

    // --- DEBUG VISUALIZER ---
    // Changes color of the fist when inside the "Hit Window" (40% - 60% of punch)
    useFrame(() => {
        if (!showDebug || !activePunch) {
            if (debugColor !== '#00ff00') setDebugColor('#00ff00');
            return;
        }

        const elapsed = performance.now() - activePunch.startTime;
        const progress = elapsed / activePunch.duration;

        // VISUAL SYNC CHECK:
        // Most punches connect at 40-60% extension. 
        // If the sphere turns RED when the arm is fully extended, your logic is synced.
        // If it turns red while retracting, we need to lower the hit threshold in Game Logic.
        if (progress > 0.4 && progress < 0.7) {
            if (debugColor !== '#ff0000') setDebugColor('#ff0000');
        } else {
            if (debugColor !== '#00ff00') setDebugColor('#00ff00');
        }
    });

    return (
        <group ref={group} position={[0, 0, 0]} scale={1} >
            <primitive object={scene} />

            {/* DEBUG SPHERES ON HANDS */}
            {showDebug && (
                <>
                    {/* Attach to hand bones roughly (Visual approximation) */}
                    <mesh position={[0, 0, 0]}>
                        <sphereGeometry args={[0.1]} />
                        <meshBasicMaterial color={debugColor} wireframe />
                    </mesh>
                    <mesh position={[0, 0, 0]}>
                        <sphereGeometry args={[0.1]} />
                        <meshBasicMaterial color={debugColor} wireframe />
                    </mesh>
                </>
            )}
        </group>
    );
}