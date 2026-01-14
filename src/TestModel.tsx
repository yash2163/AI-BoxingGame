// import React, { useEffect } from 'react';
// import { Canvas } from '@react-three/fiber';
// import { useGLTF, OrbitControls, Stage, Helper } from '@react-three/drei';
// import * as THREE from 'three';

// function DebugModel() {
//     // 1. Load the raw file
//     const { scene } = useGLTF("/models/IdleBoxer.glb");

//     useEffect(() => {
//         // 2. DIAGNOSTIC LOGS
//         console.log("🔍 --- MODEL DIAGNOSTICS ---");

//         // Calculate the actual bounding box of the model
//         const box = new THREE.Box3().setFromObject(scene);
//         const size = new THREE.Vector3();
//         box.getSize(size);
//         const center = new THREE.Vector3();
//         box.getCenter(center);

//         console.log("📦 Bounding Box Info:");
//         console.log(`   ➤ Width (X): ${size.x.toFixed(4)}`);
//         console.log(`   ➤ Height (Y): ${size.y.toFixed(4)}`);
//         console.log(`   ➤ Depth (Z): ${size.z.toFixed(4)}`);
//         console.log(`   ➤ Center Position: x:${center.x.toFixed(2)}, y:${center.y.toFixed(2)}, z:${center.z.toFixed(2)}`);

//         if (size.y < 0.1) console.error("⚠️ WARNING: Model is microscopic! Scale it up.");
//         if (size.y > 100) console.error("⚠️ WARNING: Model is massive! Scale it down.");
//         if (center.y > 50 || center.y < -50) console.error("⚠️ WARNING: Model is far from center (0,0,0)!");

//         // traversing to find mesh
//         let meshFound = false;
//         scene.traverse((obj) => {
//             if ((obj as THREE.Mesh).isMesh) {
//                 meshFound = true;
//                 // Force a bright material to ensure visibility against dark backgrounds
//                 (obj as THREE.Mesh).material = new THREE.MeshBasicMaterial({
//                     color: 'hotpink',
//                     wireframe: true
//                 });
//             }
//         });

//         if (!meshFound) console.error("❌ CRITICAL: No Meshes found in scene! File might be empty or only contain bones.");
//         else console.log("✅ Geometry found.");

//         console.log("----------------------------");
//     }, [scene]);

//     // 3. Render raw scene with a Helper Box
//     return (
//         <>
//             <primitive object={scene} />
//             <Helper type={THREE.BoxHelper} args={[scene, 'red']} />
//             <axesHelper args={[5]} /> {/* X=Red, Y=Green, Z=Blue */}
//         </>
//     );
// }

// export default function TestPage() {
//     return (
//         <div style={{ width: '100vw', height: '100vh', background: '#222' }}>
//             <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
//                 {/* Stage automatically centers and lights the model */}
//                 <Stage intensity={0.5} environment="city" adjustCamera={true}>
//                     <DebugModel />
//                 </Stage>
//                 <OrbitControls makeDefault />
//                 <gridHelper args={[20, 20]} />
//             </Canvas>

//             {/* Debug Overlay */}
//             <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', background: 'rgba(0,0,0,0.8)', padding: '20px' }}>
//                 <h2>Model Inspector</h2>
//                 <p>1. Check Console (F12) for Size/Position data.</p>
//                 <p>2. Use Mouse to Rotate/Zoom.</p>
//                 <p>3. Look for a RED BOX.</p>
//             </div>
//         </div>
//     );
// }





















// import React, { useEffect, useRef } from 'react';
// import { Canvas } from '@react-three/fiber';
// import { useGLTF, useAnimations, OrbitControls, Stage } from '@react-three/drei';

// function Inspector() {
//     const group = useRef(null);
//     // Load Model and ONE animation to compare
//     const model = useGLTF("/models/IdleBoxer.glb");
//     const anim = useGLTF("/models/LeftHook.glb");

//     const { actions } = useAnimations(anim.animations, group);

//     useEffect(() => {
//         console.log("🔍 --- INSPECTION START ---");

//         // 1. List Model Bones
//         const modelBones: string[] = [];
//         model.scene.traverse((o: any) => {
//             if (o.isBone) modelBones.push(o.name);
//         });
//         console.log("🦴 MODEL BONES (First 5):", modelBones.slice(0, 5));

//         // 2. List Animation Tracks
//         if (anim.animations.length > 0) {
//             const tracks = anim.animations[0].tracks.map((t) => t.name);
//             console.log("🎬 ANIMATION TRACKS (First 5):", tracks.slice(0, 5));

//             // 3. Auto-Play to see distortion
//             // We use the clip from the *other* file on the *model* group
//             if (actions) {
//                 const clipName = anim.animations[0].name;
//                 // We have to play the clip even if names don't match to test
//                 console.log(`▶️ Attempting to play: ${clipName}`);
//                 // Note: This might fail if names don't match, which IS the test.
//             }
//         }
//         console.log("---------------------------");
//     }, []);

//     return (
//         <group ref={group}>
//             <primitive object={model.scene} />
//         </group>
//     );
// }

// export default function TestPage() {
//     return (
//         <div style={{ height: '100vh', background: '#333' }}>
//             <Canvas camera={{ position: [0, 2, 5] }}>
//                 <Stage><Inspector /></Stage>
//                 <OrbitControls />
//             </Canvas>
//         </div>
//     );
// }



















import React, { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

function Debugger() {
    // Load all the files you are currently using
    const idle = useGLTF("/models/IdleBoxer.glb");
    const leftHook = useGLTF("/models/LeftHookBoxer.glb");
    const rightHook = useGLTF("/models/RightHookBoxer.glb");
    const leftStraight = useGLTF("/models/LeftStraightBoxer.glb");
    const rightStraight = useGLTF("/models/RightStraightBoxer.glb");

    useEffect(() => {
        console.clear();
        console.log("%c🔍 SKELETON & ANIMATION INSPECTION", "background: #222; color: #bada55; font-size: 16px; padding: 4px;");

        const inspectFile = (name: string, gltf: any) => {
            console.group(`📂 FILE: ${name}`);

            // 1. Check Skeleton (Bones in the mesh)
            const bones: string[] = [];
            gltf.scene.traverse((obj: any) => {
                if (obj.isBone) bones.push(obj.name);
            });

            if (bones.length > 0) {
                console.log(`🦴 BONES FOUND: ${bones.length}`);
                console.log(`   Sample: ${bones.slice(0, 3).join(", ")}`);
            } else {
                console.warn("   ⚠️ NO BONES FOUND IN SCENE (Is this just an animation file?)");
            }

            // 2. Check Animations (Tracks)
            if (gltf.animations.length > 0) {
                const clip = gltf.animations[0];
                console.log(`🎬 ANIMATION: "${clip.name}"`);

                // Get the first few track names to see the naming convention
                const tracks = clip.tracks.map((t: any) => t.name);
                console.log(`   Tracks Found: ${tracks.length}`);
                console.log(`   Track Format: ${tracks[0]}`); // IMPORTANT: Look at this line
            } else {
                console.error("   ❌ NO ANIMATIONS FOUND");
            }

            console.groupEnd();
        };

        inspectFile("IdleBoxer.glb", idle);
        inspectFile("LeftHookBoxer.glb", leftHook);
        inspectFile("RightHookBoxer.glb", rightHook);
        inspectFile("LeftStraightBoxer.glb", leftStraight);
        inspectFile("RightStraightBoxer.glb", rightStraight);

    }, [idle, leftHook, rightHook, leftStraight, rightStraight]);

    return null;
}

export default function BoneInspector() {
    return (
        <div style={{ width: '100vw', height: '100vh', background: '#111', color: 'white', padding: '20px' }}>
            <h1>Check your Browser Console (F12)</h1>
            <Canvas>
                <Debugger />
            </Canvas>
        </div>
    );
}