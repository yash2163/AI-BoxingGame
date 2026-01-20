import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import type { PunchProfile } from '../types';

// Preload to avoid hiccups
useGLTF.preload("/models/Idle.glb");
useGLTF.preload("/models/LS.glb");
useGLTF.preload("/models/RS.glb");
useGLTF.preload("/models/LH.glb");
useGLTF.preload("/models/RH.glb");

export function useBoxingAssets() {
    const idleGLB = useGLTF("/models/Idle.glb");
    const lsGLB = useGLTF("/models/LS.glb");
    const rsGLB = useGLTF("/models/RS.glb");
    const lhGLB = useGLTF("/models/LH.glb");
    const rhGLB = useGLTF("/models/RH.glb");

    // 1. Process Geometry (One time clone)
    const baseScene = useMemo(() => {
        const clone = SkeletonUtils.clone(idleGLB.scene);
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.frustumCulled = false;
            }
        });
        return clone;
    }, [idleGLB.scene]);

    // 2. Process Animations & Build Profiles
    const { animations, punchProfiles } = useMemo(() => {
        const sources = [
            { name: 'Idle', clip: idleGLB.animations[0], type: 'idle' },
            { name: 'LeftStraight', clip: lsGLB.animations[0], type: 'straight' },
            { name: 'RightStraight', clip: rsGLB.animations[0], type: 'straight' },
            { name: 'LeftHook', clip: lhGLB.animations[0], type: 'hook' },
            { name: 'RightHook', clip: rhGLB.animations[0], type: 'hook' }
        ];

        const clips: THREE.AnimationClip[] = [];
        const profiles: Record<string, PunchProfile> = {};

        sources.forEach(({ name, clip, type: _ }) => {
            if (!clip) return;
            const c = clip.clone();
            c.name = name;

            // Clean Tracks
            c.tracks.forEach((track) => track.name = track.name.replace('mixamorig:', 'mixamorig'));
            c.tracks = c.tracks.filter(track => !track.name.endsWith('.position'));

            clips.push(c);

            // AUTO-PROFILE: Measure the clip
            // We set standard impact points based on animation type.
            // Straight punches usually land slightly earlier (45%) than Hooks (55%).
            if (name !== 'Idle') {
                let impact = 0.5;
                if (name === 'LeftStraight') impact = 0.290;
                else if (name === 'RightStraight') impact = 0.296;
                else if (name === 'LeftHook') impact = 0.256;
                else if (name === 'RightHook') impact = 0.237;

                profiles[name] = {
                    animName: name,
                    duration: c.duration,
                    impactPoint: impact,
                    damage: 10
                };
            }
        });

        return { animations: clips, punchProfiles: profiles };
    }, [idleGLB, lsGLB, rsGLB, lhGLB, rhGLB]);

    return { scene: baseScene, animations, punchProfiles };
}