import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

// Preload immediately to ensure they are in cache
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

    // 1. Process Geometry ONCE (Clone the idle rig)
    const baseScene = useMemo(() => {
        const clone = SkeletonUtils.clone(idleGLB.scene);
        // Optimize: Traverse and set shadows/materials once here
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.frustumCulled = false; // Prevent flickering at edges
            }
        });
        return clone;
    }, [idleGLB.scene]);

    // 2. Process Animations ONCE (Clean tracks, fix names)
    const animations = useMemo(() => {
        const sources = [
            { name: 'Idle', clip: idleGLB.animations[0] },
            { name: 'LeftStraight', clip: lsGLB.animations[0] },
            { name: 'RightStraight', clip: rsGLB.animations[0] },
            { name: 'LeftHook', clip: lhGLB.animations[0] },
            { name: 'RightHook', clip: rhGLB.animations[0] }
        ];

        return sources.map(({ name, clip }) => {
            if (!clip) return null;
            const c = clip.clone();
            c.name = name;

            // Critical Fix: Mixamo Naming & Root Motion
            c.tracks.forEach((track) => {
                track.name = track.name.replace('mixamorig:', 'mixamorig');
            });
            c.tracks = c.tracks.filter(track => !track.name.endsWith('.position'));

            return c;
        }).filter(Boolean) as THREE.AnimationClip[];
    }, [idleGLB, lsGLB, rsGLB, lhGLB, rhGLB]);

    return { scene: baseScene, animations };
}