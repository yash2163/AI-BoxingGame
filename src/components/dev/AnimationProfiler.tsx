import React, { useEffect, useState } from 'react';
import { useBoxingAssets } from '../../hooks/useBoxingAssets';
import * as THREE from 'three';
import { AnimationMixer } from 'three';

/**
 * ANIMATION PROFILER
 * Automatically analyzes animation clips to find the "Impact Point".
 * 
 * LOGIC:
 * 1. Simulate the animation frame-by-frame.
 * 2. Track the position of the Left/Right hand bones.
 * 3. Find the frame where the hand is furthest forward (Max Z or Min Z depending on orientation).
 * 4. Output the ratio (Impact Time / Total Duration).
 */
export const AnimationProfiler: React.FC = () => {
    const { scene, animations } = useBoxingAssets();
    const [log, setLog] = useState<string[]>([]);

    useEffect(() => {
        if (!animations || animations.length === 0) return;

        const results: string[] = [];
        results.push("--- STARTING ANALYSIS ---");

        // 1. Setup a dummy mixer
        const mixer = new AnimationMixer(scene);
        const dummyRoot = scene;

        // 2. Find Hand Bones
        let lHand: THREE.Object3D | undefined;
        let rHand: THREE.Object3D | undefined;

        dummyRoot.traverse((child) => {
            // Check common Mixamo names
            if (child.name.includes("LeftHand")) lHand = child;
            if (child.name.includes("RightHand")) rHand = child;
        });

        if (!lHand || !rHand) {
            results.push("❌ CRITICAL: Could not find hand bones (mixamorigLeftHand/RightHand).");
            setLog(results);
            return;
        }

        results.push(`✅ Bones Found: L=${lHand.name}, R=${rHand.name}`);

        // 3. Analyze Each Clip
        animations.forEach(clip => {
            if (clip.name === 'Idle') return; // Skip idle

            const isLeft = clip.name.toLowerCase().includes('left');
            const targetBone = isLeft ? lHand : rHand;
            if (!targetBone) return;

            // Create Action
            const action = mixer.clipAction(clip);
            action.play();

            const duration = clip.duration;
            // const samples = 60; 
            const totalFrames = Math.floor(duration * 60);

            let maxExtension = -Infinity;
            let impactTime = 0;

            // Simulation Loop
            for (let i = 0; i <= totalFrames; i++) {
                const t = (i / totalFrames) * duration;

                // Scrub mixer to exact time
                mixer.setTime(t);
                // Force update of scene matrices to get world positions
                dummyRoot.updateMatrixWorld(true);

                const pos = new THREE.Vector3();
                targetBone.getWorldPosition(pos);

                // In standard Mixamo + ThreeJS setup:
                // Forward is usually +Z or -Z. 
                // We assume the opponent faces +Z (towards camera at Z=2).
                // So "Extension" means LARGER Z value.
                // Wait, opponent is usually at Z=0 facing Z=2?
                // Let's use distance from body center (Root) to be safe.

                // Simple Distance from origin (Root is usually 0,0,0)
                // This is safer than axis assumption.
                // Punching extends the hand AWAY from the body.
                const dist = pos.length(); // simple distance

                if (dist > maxExtension) {
                    maxExtension = dist;
                    impactTime = t;
                }
            }

            const impactRatio = impactTime / duration;

            results.push(`\n🥊 ANIMATION: ${clip.name}`);
            results.push(`   Duration: ${duration.toFixed(3)}s`);
            results.push(`   Max Extension at: ${impactTime.toFixed(3)}s`);
            results.push(`   Suggested ImpactPoint: ${impactRatio.toFixed(3)}`);

            action.stop();
        });

        results.push("\n--- ANALYSIS COMPLETE ---");
        setLog(results);

    }, [animations, scene]);

    return (
        <div className="fixed inset-0 bg-black text-green-400 font-mono p-8 overflow-auto z-50">
            <h1 className="text-xl font-bold border-b border-green-500 mb-4 pb-2">Animation Auto-Profiler</h1>
            <pre className="whitespace-pre-wrap">
                {log.join('\n')}
            </pre>
            <div className="mt-8 text-white opacity-50 text-sm">
                * If values look wrong (e.g. 0.0 or 1.0), the bone detection might be failing or the model scale is off.
                <br />
                * Copy these 'Suggested ImpactPoint' values into useBoxingAssets.ts.
            </div>
        </div>
    );
};
