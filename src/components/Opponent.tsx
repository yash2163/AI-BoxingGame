import { useEffect, useRef, useState } from 'react';
import { useAnimations } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LoopOnce, LoopRepeat } from 'three';
import { useBoxingAssets } from '../hooks/useBoxingAssets';

// Wait, OpponentBase is used? No, OpponentBase IS the component in OpponentBase.tsx. 
// Opponent.tsx uses `scene` from `useBoxingAssets` which likely contains the loaded GLTF?
// Line 18: `const { scene, animations } = useBoxingAssets();`
// Line 118: `<primitive object={scene} />` - It renders the scene directly.
// So `OpponentBase` import IS unused in the original file? 
// Step 217 showed `import { OpponentBase } from './OpponentBase';` but it is NOT used in the code block!
// So I will remove it.

import type { ActivePunch } from '../types';

interface OpponentProps {
    activePunch: ActivePunch | null; // Strict Type
    speedMultiplier: number;
    showDebug?: boolean;
}

export function Opponent({ activePunch, speedMultiplier: _speed, showDebug = true }: OpponentProps) {
    const group = useRef<THREE.Group>(null);
    const { scene, animations } = useBoxingAssets();
    const { actions } = useAnimations(animations, group);
    const { camera } = useThree();

    const currentAction = useRef<THREE.AnimationAction | null>(null);
    const [debugColor, setDebugColor] = useState('#00ff00');

    // 1. Initial Idle State
    useEffect(() => {
        const idle = actions['Idle'];
        if (idle) {
            idle.setLoop(LoopRepeat, Infinity);
            idle.reset().fadeIn(0.5).play();
            currentAction.current = idle;
        }
    }, [actions]);

    // 2. Punch Trigger Logic
    useEffect(() => {
        if (!activePunch) return;

        // Map data to animation name
        const actionName = activePunch.type === 'hook'
            ? (activePunch.side === 'left' ? 'LeftHook' : 'RightHook')
            : (activePunch.side === 'left' ? 'LeftStraight' : 'RightStraight');

        const punch = actions[actionName];
        const idle = actions['Idle'];

        if (!punch || !idle) return;

        // --- PRECISE TIMING ---
        // We use the EXACT duration calculated by the Scheduler
        const clipDuration = punch.getClip().duration;
        const gameDurationSec = activePunch.duration / 1000;

        // Calculate exact playback speed to match game clock
        // If game wants 1.2s and clip is 2.4s, speed = 2.0x
        const requiredSpeed = clipDuration / gameDurationSec;

        punch.timeScale = requiredSpeed;

        // --- ANIMATION BLENDING ---
        const previous = currentAction.current || idle;
        previous.fadeOut(0.15); // Fast snap for responsiveness

        punch.reset();
        punch.setLoop(LoopOnce, 1);
        punch.clampWhenFinished = true;
        punch.fadeIn(0.15).play();
        currentAction.current = punch;

        // --- CLEANUP ---
        // Return to Idle exactly when the punch duration ends
        const timer = setTimeout(() => {
            punch.fadeOut(0.3);
            idle.reset().fadeIn(0.3).play();
            currentAction.current = idle;

        }, activePunch.duration);

        return () => clearTimeout(timer);

    }, [activePunch?.id, actions, camera]); // Only re-run if Punch ID changes

    // --- VISUAL DEBUGGER ---
    // Helps you see if the logic matches the visual
    useFrame(() => {
        if (!showDebug || !activePunch) return;

        const elapsed = performance.now() - activePunch.startTime;
        const progress = elapsed / activePunch.duration;

        // Visual check: Sphere turns red during the "Danger Zone"
        // Adjust these numbers if visual doesn't match feel
        if (progress > 0.40 && progress < 0.70) {
            setDebugColor('#ff0000');
        } else {
            setDebugColor('#00ff00');
        }
    });

    return (
        <group ref={group} position={[0, 0, 0]} scale={1}>
            <primitive object={scene} />

            {/* DEBUG VISUALS */}
            {showDebug && (
                <mesh position={[0, 1.4, 0.5]}>
                    <sphereGeometry args={[0.15]} />
                    <meshBasicMaterial color={debugColor} wireframe transparent opacity={0.5} />
                </mesh>
            )}
        </group>
    );
}