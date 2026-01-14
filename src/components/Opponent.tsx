import React, { useEffect, useMemo, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { LoopOnce, LoopRepeat } from 'three';
import gsap from 'gsap';

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
}

export function Opponent({ activePunch, speedMultiplier }: OpponentProps) {
    const group = useRef<THREE.Group>(null);
    const currentAction = useRef<THREE.AnimationAction | null>(null);
    const { camera } = useThree(); // Standard way to access camera

    // Load GLBs
    const idleGLB = useGLTF("/models/Idle.glb");
    const lsGLB = useGLTF("/models/LS.glb");
    const rsGLB = useGLTF("/models/RS.glb");
    const lhGLB = useGLTF("/models/LH.glb");
    const rhGLB = useGLTF("/models/RH.glb");

    // Clone rig
    const clone = useMemo(() => SkeletonUtils.clone(idleGLB.scene), [idleGLB.scene]);

    // Merge & Clean Animations
    const animations = useMemo(() => {
        const sources = [
            { name: 'Idle', clip: idleGLB.animations[0] },
            { name: 'LeftStraight', clip: lsGLB.animations[0] },
            { name: 'RightStraight', clip: rsGLB.animations[0] },
            { name: 'LeftHook', clip: lhGLB.animations[0] },
            { name: 'RightHook', clip: rhGLB.animations[0] }
        ];

        return sources.map(({ name, clip }) => {
            const c = clip.clone();
            c.name = name;

            // 1. Fix Bone Names (Crucial for Mixamo rigs)
            c.tracks.forEach((track) => {
                track.name = track.name.replace('mixamorig:', 'mixamorig');
            });

            // 2. Remove Position Tracks (Keeps opponent grounded/centered)
            c.tracks = c.tracks.filter(track => !track.name.endsWith('.position'));

            return c;
        });
    }, [idleGLB, lsGLB, rsGLB, lhGLB, rhGLB]);

    const { actions } = useAnimations(animations, group);

    // Start Idle
    useEffect(() => {
        const idle = actions['Idle'];
        if (!idle) return;

        console.log('🧍 Idle started');
        idle.setLoop(LoopRepeat, Infinity);
        idle.reset().fadeIn(0.3).play();
        currentAction.current = idle;

        return () => { idle.fadeOut(0.2); };
    }, [actions]);

    // Handle Punch Trigger
    useEffect(() => {
        if (!activePunch) return;

        const actionName =
            activePunch.type === 'hook'
                ? activePunch.side === 'left' ? 'LeftHook' : 'RightHook'
                : activePunch.side === 'left' ? 'LeftStraight' : 'RightStraight';

        const punch = actions[actionName];
        const idle = actions['Idle'];

        if (!punch || !idle) return;

        console.log('🥊 Punch Triggered:', actionName);

        // --- SPEED & TIMING CALCULATION ---
        const clipDuration = punch.getClip().duration;

        // If the game provided a duration (from GeminiBoxingCoach), use it to calc scale.
        // Otherwise, fall back to speedMultiplier directly.
        let appliedTimeScale = speedMultiplier;

        if (activePunch.duration > 0) {
            const gameDurationSec = activePunch.duration / 1000;
            // Calculate exact speed needed to finish within game window
            appliedTimeScale = clipDuration / gameDurationSec;
            // Safety Clamp (0.5x to 3.0x)
            appliedTimeScale = THREE.MathUtils.clamp(appliedTimeScale, 0.5, 3.0);
        }

        punch.timeScale = appliedTimeScale;

        // --- ANIMATION BLENDING ---
        const previous = currentAction.current || idle;
        previous.fadeOut(0.2);

        punch.reset();
        punch.setLoop(LoopOnce, 1);
        punch.clampWhenFinished = true;
        punch.fadeIn(0.2).play();
        currentAction.current = punch;

        // --- GSAP CAMERA IMPACT (The "Impressive" Feel) ---
        // Push in slightly when punch starts
        // const initialZ = 2.2; // Based on your Scene3D camera setup
        // gsap.killTweensOf(camera.position); // Stop any running moves
        // gsap.to(camera.position, {
        //     z: initialZ - 0.4, // Move closer by 0.4m
        //     duration: 0.2,     // Fast zoom in
        //     ease: "power2.out"
        // });

        // --- CLEANUP / RETURN TO IDLE ---
        // We use setTimeout based on the *Game Duration* to ensure logic sync
        const cleanupTime = activePunch.duration > 0
            ? activePunch.duration
            : (clipDuration / appliedTimeScale) * 1000;

        const timer = setTimeout(() => {
            console.log('✅ Punch finished — returning to idle');

            // 1. Blend Animations
            punch.fadeOut(0.3);
            idle.reset().fadeIn(0.3).play();
            currentAction.current = idle;

            // // 2. Reset Camera
            // gsap.to(camera.position, {
            //     z: initialZ,
            //     duration: 0.5,
            //     ease: "elastic.out(1, 0.75)" // Bouncy return
            // });

        }, cleanupTime);

        return () => clearTimeout(timer);

    }, [activePunch?.id, actions, camera, speedMultiplier]);

    // Materials (Clean Look - No Flash)
    useEffect(() => {
        clone.traverse(obj => {
            if (!(obj as THREE.Mesh).isMesh) return;
            const mesh = obj as THREE.Mesh;

            // Apply materials only once or update props
            if (!mesh.userData.init) {
                mesh.material = new THREE.MeshStandardMaterial({
                    color: new THREE.Color('#00aaff'), // Clean Cyber Blue
                    emissive: new THREE.Color('#0044aa'),
                    emissiveIntensity: 0.5,
                    roughness: 0.2,
                    metalness: 0.8,
                    toneMapped: false
                });
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData.init = true;
            }
        });
    }, [clone]);

    return (
        // Position: -0.9 puts feet on floor (assuming 1.8m height centered at 0)
        // Scale: 1 (Assuming models are already correct scale, otherwise use 0.01)
        <group ref={group} position={[0, 0, 0]} scale={1} rotation={[0, Math.PI / 8, 0]}>
            <primitive object={clone} />
        </group>
    );
}

// Preloads
useGLTF.preload('/models/Idle.glb');
useGLTF.preload('/models/LS.glb');
useGLTF.preload('/models/RS.glb');
useGLTF.preload('/models/LH.glb');
useGLTF.preload('/models/RH.glb');