import React, { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Environment, Circle } from '@react-three/drei';
import { Opponent } from './Opponent';
import type { ActivePunch } from '../types';

const BoxingRing = () => (
    <group position={[0, -1.8, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.8} metalness={0.2} />
        </mesh>
    </group>
);

interface Props {
    activePunchRef: React.RefObject<ActivePunch | null>;
    speedMultiplier: number;
    showOpponent?: boolean;
    showRing?: boolean;
    headPos?: { x: number; y: number };
}

const SceneContent: React.FC<Props> = ({ activePunchRef, speedMultiplier, showOpponent = true, showRing = true, headPos }) => {
    const [punchData, setPunchData] = useState<ActivePunch | null>(null);
    const lastPunchId = useRef<string>("");

    useFrame(() => {
        if (activePunchRef.current && activePunchRef.current.id !== lastPunchId.current) {
            lastPunchId.current = activePunchRef.current.id;
            setPunchData({ ...activePunchRef.current });
        }
    });

    return (
        <>
            <Environment preset="city" />
            <ambientLight intensity={0.5} />
            <directionalLight position={[0, 5, 5]} intensity={1.2} castShadow />
            <PerspectiveCamera makeDefault position={[0, 1.6, 2.5]} fov={60} />

            {showRing && <BoxingRing />}
            {showRing && (
                <Circle args={[10]} rotation-x={-Math.PI / 2} receiveShadow>
                    <meshStandardMaterial color="#222" transparent opacity={0.8} />
                </Circle>
            )}
            {showOpponent && (
                <Opponent
                    activePunch={punchData}
                    speedMultiplier={speedMultiplier}
                    showDebug={false}
                    headPos={headPos}
                />
            )}
        </>
    );
};

export const Scene3D: React.FC<Props> = (props) => (
    <div className="absolute inset-0 z-20 pointer-events-none">
        <Canvas shadows gl={{ antialias: true, alpha: true }}>
            <SceneContent {...props} />
        </Canvas>
    </div>
);