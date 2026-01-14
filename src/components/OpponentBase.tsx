import * as THREE from 'three'
import React, { useEffect } from 'react'
import { useGraph } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { GLTF, SkeletonUtils } from 'three-stdlib'

type ActionName =
  | 'Idle'
  | 'LeftHook'
  | 'RightHook'
  | 'LeftStraight'
  | 'RightStraight'

interface GLTFAction extends THREE.AnimationClip {
  name: ActionName
}

type GLTFResult = GLTF & {
  nodes: {
    Beta_Joints: THREE.SkinnedMesh
    Beta_Surface: THREE.SkinnedMesh
    mixamorigHips: THREE.Bone
  }
  materials: {
    ['Beta_Joints_MAT1.004']: THREE.MeshStandardMaterial
    ['Beta_HighLimbsGeoSG3.004']: THREE.MeshStandardMaterial
  }
  animations: GLTFAction[]
}

export function OpponentBase(props: JSX.IntrinsicElements['group']) {
  const group = React.useRef<THREE.Group>(null!)

  // ✅ Correct path
  const { scene, animations } = useGLTF('/models/Boxer.glb')

  // Clone for proper skeleton binding
  const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes, materials } = useGraph(clone) as GLTFResult

  const { actions } = useAnimations(animations, group)

  // ✅ Play Idle on load
  useEffect(() => {
    if (actions['Idle']) {
      actions['Idle'].reset().fadeIn(0.3).play()
    }
  }, [actions])

  return (
    <group
      ref={group}
      {...props}
      dispose={null}
      position={[0, -1.2, 0]}
      scale={1.2}
    >
      <primitive object={nodes.mixamorigHips} />
      <skinnedMesh
        geometry={nodes.Beta_Joints.geometry}
        material={materials['Beta_Joints_MAT1.004']}
        skeleton={nodes.Beta_Joints.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Beta_Surface.geometry}
        material={materials['Beta_HighLimbsGeoSG3.004']}
        skeleton={nodes.Beta_Surface.skeleton}
      />
    </group>
  )
}

useGLTF.preload('/models/Boxer.glb')
