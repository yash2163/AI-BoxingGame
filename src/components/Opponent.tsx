import React, { useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { LoopOnce, LoopRepeat } from 'three';

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
}

export function Opponent({ activePunch }: OpponentProps) {
    const [isHit, setIsHit] = useState(false);

    // Load GLBs
    const idleGLB = useGLTF("/models/Idle.glb");
    const leftHookGLB = useGLTF("/models/LH.glb");
    const rightHookGLB = useGLTF("/models/RH.glb");
    const leftStraightGLB = useGLTF("/models/LS.glb");
    const rightStraightGLB = useGLTF("/models/RS.glb");

    // Clone base rig
    const clone = useMemo(
        () => SkeletonUtils.clone(idleGLB.scene),
        [idleGLB.scene]
    );

    // Merge animations
    const animations = useMemo(() => {
        const clips: THREE.AnimationClip[] = [];

        const loadClip = (gltf: any, name: string) => {
            if (!gltf.animations.length) {
                console.warn("❌ No animation in", name);
                return;
            }

            const clip = gltf.animations[0].clone();
            clip.name = name;

            clip.tracks.forEach((track) => {
                track.name = track.name.replace('mixamorig:', 'mixamorig');
            });

            clip.tracks = clip.tracks.filter(
                (track) => !track.name.includes(".position")
            );

            console.log(`✅ Loaded clip: ${name}, duration: ${clip.duration.toFixed(2)}s`);
            clips.push(clip);
        };

        loadClip(idleGLB, "Idle");
        loadClip(leftHookGLB, "LeftHook");
        loadClip(rightHookGLB, "RightHook");
        loadClip(leftStraightGLB, "LeftStraight");
        loadClip(rightStraightGLB, "RightStraight");

        return clips;
    }, [idleGLB, leftHookGLB, rightHookGLB, leftStraightGLB, rightStraightGLB]);

    // Bind animations to skeleton
    const { actions } = useAnimations(animations, clone);

    // Log bound actions once
    useEffect(() => {
        console.log("🎬 Bound Actions:", Object.keys(actions));
    }, [actions]);

    // Start idle
    useEffect(() => {
        const idle = actions["Idle"];
        if (!idle) return;

        console.log("🧍 Idle started");
        idle.setLoop(LoopRepeat, Infinity);
        idle.reset().fadeIn(0.3).play();

        return () => idle.fadeOut(0.2);
    }, [actions]);

    // React to punch events
    useEffect(() => {
        if (!activePunch) return;

        const actionName =
            activePunch.type === "hook"
                ? (activePunch.side === "left" ? "LeftHook" : "RightHook")
                : (activePunch.side === "left" ? "LeftStraight" : "RightStraight");

        const punchAction = actions[actionName];
        const idleAction = actions["Idle"];

        if (!punchAction || !idleAction) {
            console.warn("❌ Missing action", actionName);
            return;
        }

        console.log(`🥊 TRIGGER: ${actionName}`);
        console.log("📦 Punch data:", activePunch);

        // Hit flash
        setIsHit(true);
        setTimeout(() => setIsHit(false), 150);

        // Timescale sync
        const clipDuration = punchAction.getClip().duration;
        const gameDurationSec = activePunch.duration / 1000;
        const speed = THREE.MathUtils.clamp(clipDuration / gameDurationSec, 0.8, 1.4);
        punchAction.timeScale = speed;

        console.log(`⏱ ClipDuration=${clipDuration.toFixed(2)}s GameDuration=${gameDurationSec.toFixed(2)}s TimeScale=${speed.toFixed(2)}`);

        // Crossfade
        idleAction.fadeOut(0.25);
        punchAction.setLoop(LoopOnce, 1);
        punchAction.clampWhenFinished = true;
        punchAction.reset().fadeIn(0.25).play();

        console.log(`▶️ Playing ${actionName}`);

        // Return to idle
        const timer = setTimeout(() => {
            console.log(`↩️ Returning to Idle from ${actionName}`);
            punchAction.fadeOut(0.25);
            idleAction.reset().fadeIn(0.25).play();
        }, activePunch.duration + 150);

        return () => clearTimeout(timer);
    }, [activePunch?.id, actions]);

    // Materials (no recreation)
    useEffect(() => {
        const hitColor = new THREE.Color("#ff0000");
        const normalColor = new THREE.Color("#00ffff");
        const hitEmissive = new THREE.Color("#ff0000");
        const normalEmissive = new THREE.Color("#0044aa");

        clone.traverse((child) => {
            if (!(child as THREE.Mesh).isMesh) return;
            const mesh = child as THREE.Mesh;

            if (!mesh.material || Array.isArray(mesh.material)) {
                mesh.material = new THREE.MeshStandardMaterial();
            }

            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.roughness = 0.15;
            mat.metalness = 0.85;
            mat.toneMapped = false;

            mat.color = isHit ? hitColor : normalColor;
            mat.emissive = isHit ? hitEmissive : normalEmissive;
            mat.emissiveIntensity = isHit ? 2.0 : 1.3;

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
        });
    }, [clone, isHit]);

    // Final render (rotation applied correctly here)
    return (
        <group position={[0, -0.1, 0]} scale={2} rotation={[0, Math.PI / 6, 0]}>
            <primitive object={clone} />
        </group>
    );
}

// Preloads
useGLTF.preload("/models/Idle.glb");
useGLTF.preload("/models/LH.glb");
useGLTF.preload("/models/RH.glb");
useGLTF.preload("/models/LS.glb");
useGLTF.preload("/models/RS.glb");
