import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Zap, Trophy, Activity, Camera, ScanFace, BrainCircuit, Ruler } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import Markdown from 'markdown-to-jsx';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, Environment, Circle } from '@react-three/drei';

// --- IMPORT MODULES ---
import { Opponent } from './components/Opponent';
import { useBoxingAssets } from './hooks/useBoxingAssets';
import { analyzeUserPose, judgeImpact } from './logic/Referee';
import type {
    GameState, PunchSide, PunchType, DodgeRating,
    PoseResult, CalibrationData, FightEvent, ActivePunch
} from './types';

// --- CONFIG ---
const ROUND_TIME = 60;
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const MP_VERSION = "0.5.1675469404";

// --- 3D SCENE ---
const BoxingRing = () => (
    <group position={[0, -3.5, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#f0f0f0" roughness={0.5} metalness={0.1} />
        </mesh>
        {/* Ropes and Posts */}
        {[1, 2, 3, 4].map((h, i) => (
            <group key={i} position={[0, h * 0.7, 0]}>
                <mesh position={[0, 0, -7]} rotation={[0, 0, 1.57]}><cylinderGeometry args={[0.02, 0.02, 14]} /><meshStandardMaterial color="#333" /></mesh>
                <mesh position={[0, 0, 7]} rotation={[0, 0, 1.57]}><cylinderGeometry args={[0.02, 0.02, 14]} /><meshStandardMaterial color="#333" /></mesh>
                <mesh position={[-7, 0, 0]} rotation={[1.57, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 14]} /><meshStandardMaterial color="#333" /></mesh>
                <mesh position={[7, 0, 0]} rotation={[1.57, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 14]} /><meshStandardMaterial color="#333" /></mesh>
            </group>
        ))}
        {[[-7, -7], [7, -7], [-7, 7], [7, 7]].map(([x, z], i) => <mesh key={i} position={[x, 2.5, z]}><cylinderGeometry args={[0.1, 0.1, 6]} /><meshStandardMaterial color="#999" roughness={0.2} metalness={0.8} /></mesh>)}
    </group>
);

const Scene3D: React.FC<{ activePunchRef: React.RefObject<ActivePunch | null>, speedMultiplier: number }> = ({ activePunchRef, speedMultiplier }) => {
    const [punchData, setPunchData] = useState<ActivePunch | null>(null);
    const lastPunchId = useRef<string>("");

    // Sync Ref to State for React Three Fiber (Manual subscription)
    React.useEffect(() => {
        const interval = setInterval(() => {
            if (activePunchRef.current && activePunchRef.current.id !== lastPunchId.current) {
                lastPunchId.current = activePunchRef.current.id;
                setPunchData({ ...activePunchRef.current });
            }
            if (!activePunchRef.current && punchData !== null) setPunchData(null);
        }, 16);
        return () => clearInterval(interval);
    }, [punchData]);

    return (
        <>
            <color attach="background" args={["#e5e5e5"]} />
            <Environment preset="city" />
            <ambientLight intensity={0.6} />
            <directionalLight position={[2, 5, 2]} intensity={1.5} castShadow />

            <PerspectiveCamera makeDefault position={[0, 1.3, 2.2]} fov={70} />

            <BoxingRing />

            {/* Dumb Visualizer */}
            <Opponent activePunch={punchData} speedMultiplier={speedMultiplier} showDebug={false} />

            <Circle args={[10]} rotation-x={-Math.PI / 2} receiveShadow>
                <meshStandardMaterial color="#444" />
            </Circle>
        </>
    );
};

// --- MAIN APP ---
const GeminiBoxingCoach: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Refs
    const gameStateRef = useRef<GameState>('IDLE');
    const activePunchRef = useRef<ActivePunch | null>(null); // Use new Type
    const calibrationRef = useRef<CalibrationData>({ baselineY: 0.5, shoulderWidth: 0.1 });
    const fightLogRef = useRef<FightEvent[]>([]);
    const scoreRef = useRef<number>(0);
    const comboRef = useRef<number>(0);
    const timeLeftRef = useRef<number>(ROUND_TIME);
    const timerRef = useRef<number | null>(null);

    // Live Pose Tracking
    const currentPoseRef = useRef<PoseResult>({ label: 'NEUTRAL', leanRatio: 0, duckRatio: 0 });

    // Load Assets & Profiles
    const { punchProfiles } = useBoxingAssets();

    // State
    const [gameState, setGameState] = useState<GameState>('IDLE');
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
    const speedMultiplierRef = useRef(1.0); // Ref for sync

    // UI State
    const [bonusText, setBonusText] = useState<{ msg: string, color: string } | null>(null);
    const [calibrationCount, setCalibrationCount] = useState<number | null>(null);
    const [aiFeedback, setAiFeedback] = useState<string>("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [damageFlash, setDamageFlash] = useState(false);

    // Sync State to Refs
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    useEffect(() => { speedMultiplierRef.current = speedMultiplier; }, [speedMultiplier]);

    // --- GAME LOOP ---
    const scheduleNextPunch = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (gameStateRef.current !== 'PLAYING' || timeLeftRef.current <= 0) return;

        const currentSpeed = speedMultiplierRef.current;
        // Faster Idle at higher speeds
        const idleDelay = (1000 + Math.random() * 1500) / currentSpeed;

        timerRef.current = window.setTimeout(() => {
            if (gameStateRef.current !== 'PLAYING') return;

            // Pick Random Punch
            const options = ['LeftStraight', 'RightStraight', 'LeftHook', 'RightHook'];
            const animName = options[Math.floor(Math.random() * options.length)];

            // Get Exact Profile
            const profile = punchProfiles[animName];
            if (!profile) {
                console.warn("Missing profile for", animName);
                scheduleNextPunch(); // Skip and retry
                return;
            }

            // Calculate Times
            const now = performance.now();
            // Duration is scaled by speed (e.g. 1.2s clip / 2x speed = 0.6s duration)
            const duration = (profile.duration * 1000) / currentSpeed;
            const impactTime = duration * profile.impactPoint;

            // Define Punch
            const side = animName.toLowerCase().includes('left') ? 'left' : 'right';
            const type = animName.toLowerCase().includes('hook') ? 'hook' : 'straight';

            activePunchRef.current = {
                id: `punch-${now}-${Math.random()}`,
                side: side as PunchSide,
                type: type as PunchType,
                startTime: now,
                impactTime: now + impactTime, // The Golden Moment
                duration: duration,
                status: 'flying'
            };

            // Loop: Schedule next punch after this one finishes
            // We wait for the punch duration + a tiny buffer
            timerRef.current = window.setTimeout(scheduleNextPunch, duration + 100);

        }, idleDelay);
    }, [punchProfiles]); // Re-create if profiles change (they load once)

    // Loop Controller
    useEffect(() => {
        if (gameState === 'PLAYING') scheduleNextPunch();
        else if (timerRef.current) clearTimeout(timerRef.current);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [gameState, scheduleNextPunch]);

    // --- CALIBRATION ROUTINE ---
    const startCalibration = () => {
        setGameState('CALIBRATING');
        setCalibrationCount(3);

        let count = 3;
        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                setCalibrationCount(count);
            } else {
                clearInterval(interval);
                setCalibrationCount(null);
                setGameState('PLAYING');
                scheduleNextPunch();
            }
        }, 1000);
    };

    // --- GEN AI COACH ---
    const generateCoachingAdvice = async () => {
        if (!API_KEY) { setAiFeedback("⚠️ API Key Missing."); return; }
        setIsAnalyzing(true);
        try {
            const genAI = new GoogleGenerativeAI(API_KEY);
            let model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const stats = { total: fightLogRef.current.length, hits: fightLogRef.current.filter(e => e.scoreDelta < 0).length };
            const prompt = `ROLE: Boxing Coach. STATS: ${JSON.stringify(stats)}. LOG: ${JSON.stringify(fightLogRef.current)}. Give short, punchy advice.`;
            const result = await model.generateContent(prompt);
            setAiFeedback((await result.response).text());
        } catch (error) { setAiFeedback("AI Offline."); }
        setIsAnalyzing(false);
    };

    // --- TIMER UI ---
    useEffect(() => {
        let interval: number;
        if (gameState === 'PLAYING') {
            interval = window.setInterval(() => {
                setTimeLeft(prev => {
                    const newVal = prev - 1;
                    if (newVal <= 0) {
                        setGameState('FINISHED');
                        return 0;
                    }
                    return newVal;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [gameState]);

    // --- MEDIAPIPE INIT ---
    useEffect(() => {
        if (!videoRef.current || !canvasRef.current) return;
        let pose: any = null;
        let cameraInstance: any = null;

        const loadPose = async () => {
            if (!window.Pose) {
                const script = document.createElement('script');
                script.src = `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${MP_VERSION}/pose.js`;
                script.async = true;
                script.crossOrigin = "anonymous";
                document.body.appendChild(script);
                await new Promise(r => script.onload = r);
            }

            pose = new window.Pose({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${MP_VERSION}/${file}` });
            pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });

            pose.onResults((results: any) => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                if (canvas.width !== containerRef.current?.clientWidth) {
                    canvas.width = containerRef.current!.clientWidth;
                    canvas.height = containerRef.current!.clientHeight;
                }

                // Render Video (Mirrored)
                ctx.save();
                ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
                ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
                ctx.restore();

                if (!results.poseLandmarks) return;

                // 1. Process Logic
                if (gameStateRef.current === 'CALIBRATING') {
                    const nose = results.poseLandmarks[0];
                    const left = results.poseLandmarks[11];
                    const right = results.poseLandmarks[12];
                    const width = Math.abs(left.x - right.x);

                    calibrationRef.current = { baselineY: nose.y, shoulderWidth: width };

                    // Draw Calibration Box
                    ctx.strokeStyle = 'cyan'; ctx.lineWidth = 4;
                    const x = (1 - nose.x) * canvas.width; // Mirror X
                    const y = nose.y * canvas.height;
                    ctx.strokeRect(x - 50, y - 50, 100, 100);
                }
                else if (gameStateRef.current === 'PLAYING') {
                    // --- NEW LOGIC: Use Referee.ts ---
                    const poseAnalysis = analyzeUserPose(results.poseLandmarks, calibrationRef.current);
                    currentPoseRef.current = poseAnalysis;

                    // Hit Logic
                    const p = activePunchRef.current;
                    if (p && p.status === 'flying') {
                        const now = performance.now();
                        const elapsed = now - p.startTime;
                        const progress = elapsed / p.duration;

                        // ACTIVE WINDOW CHECK (0.35 to 0.75)
                        // This allows for early reactions and slightly late ones, centered on the Impact Point.
                        if (progress > 0.35 && progress < 0.75) {

                            // Ask the Judge
                            const rating = judgeImpact(p.type, p.side, poseAnalysis);

                            if (rating !== 'HIT' && rating !== 'TOO_FAR') {
                                // SUCCESS!
                                p.status = 'dodged';
                                p.rating = rating;

                                const points = rating === 'PERFECT' ? 300 : 100;
                                scoreRef.current += points;
                                comboRef.current += 1;

                                setScore(scoreRef.current);
                                setBonusText({ msg: rating, color: 'text-green-400' });
                                setTimeout(() => setBonusText(null), 800);

                                fightLogRef.current.push({
                                    time: ROUND_TIME - timeLeftRef.current,
                                    punch: `${p.side}_${p.type}`,
                                    userMove: poseAnalysis.label,
                                    outcome: rating,
                                    scoreDelta: points
                                });
                            }
                        }

                        // FAILURE CHECK (Window Closed)
                        // If we passed 75% and still haven't dodged...
                        if (progress >= 0.75 && p.status === 'flying') {
                            p.status = 'hit';
                            p.rating = 'HIT';

                            scoreRef.current = Math.max(0, scoreRef.current - 100);
                            comboRef.current = 0;

                            setScore(scoreRef.current);
                            setDamageFlash(true);
                            setTimeout(() => setDamageFlash(false), 200);

                            setBonusText({ msg: "HIT!", color: 'text-red-500' });
                            setTimeout(() => setBonusText(null), 800);

                            fightLogRef.current.push({
                                time: ROUND_TIME - timeLeftRef.current,
                                punch: `${p.side}_${p.type}`,
                                userMove: poseAnalysis.label,
                                outcome: 'HIT',
                                scoreDelta: -100
                            });
                        }
                    }

                    // --- DEBUG HUD (Cleaned Up) ---
                    // Shows the raw math so you can tune it
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                    ctx.fillRect(10, 10, 200, 100);

                    ctx.fillStyle = 'white';
                    ctx.font = '16px monospace';
                    ctx.fillText(`POSE: ${poseAnalysis.label}`, 20, 35);
                    ctx.fillText(`LEAN: ${poseAnalysis.leanRatio.toFixed(2)}`, 20, 60);
                    ctx.fillText(`DUCK: ${poseAnalysis.duckRatio.toFixed(2)}`, 20, 85);
                }
            });

            cameraInstance = new window.Camera(videoRef.current, {
                onFrame: async () => { if (videoRef.current) await pose.send({ image: videoRef.current }); },
                width: 1280, height: 720
            });
            cameraInstance.start();
            setCameraReady(true);
        };

        loadPose();
        return () => { if (cameraInstance) cameraInstance.stop(); if (pose) pose.close(); };
    }, []);

    return (
        <div className="w-full h-screen bg-gray-900 font-sans text-white relative select-none overflow-hidden">
            {/* UI LAYER */}
            <div className="absolute top-0 left-0 p-8 z-30 w-full flex justify-between pointer-events-none">
                <div className="bg-black/50 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                    <div className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-1">Score</div>
                    <div className="text-6xl font-black text-white">{score.toLocaleString()}</div>
                </div>
                {gameState === 'PLAYING' && (
                    <div className="flex gap-4">
                        <div className="bg-black/50 backdrop-blur-md px-8 py-4 rounded-full border border-white/10 flex items-center gap-2">
                            <div className="text-4xl font-black text-red-500">{timeLeft}s</div>
                        </div>
                        <div className="bg-black/50 backdrop-blur-md px-6 py-4 rounded-full border border-white/10 flex items-center gap-2">
                            <Zap className="text-yellow-500 w-6 h-6 fill-current" />
                            <div className="text-2xl font-bold text-white">{comboRef.current}x</div>
                        </div>
                    </div>
                )}
            </div>

            {/* SPEED SLIDER */}
            <div className="absolute top-8 right-8 z-50 pointer-events-auto bg-black/50 backdrop-blur-md px-6 py-4 rounded-full border border-white/10">
                <div className="text-xs font-bold text-gray-400">SPEED</div>
                <div className="flex items-center gap-2">
                    <input type="range" min="0.5" max="2.0" step="0.1" value={speedMultiplier} onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))} className="accent-blue-500" />
                    <div className="text-sm font-bold w-10">{speedMultiplier}x</div>
                </div>
            </div>

            {/* OVERLAYS */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none">
                {damageFlash && <div className="absolute inset-0 bg-red-500/30 mix-blend-overlay" />}
                {bonusText && <div className={`text-8xl font-black italic drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] scale-110 duration-75 ${bonusText.color}`}>{bonusText.msg}</div>}

                {gameState === 'CALIBRATING' && (
                    <div className="flex flex-col items-center gap-8 animate-in zoom-in duration-300">
                        <ScanFace className="w-32 h-32 text-blue-500 animate-pulse" />
                        <h2 className="text-6xl font-black text-white">STAND STILL</h2>
                        <div className="text-[120px] font-black text-blue-500">{calibrationCount}</div>
                        <p className="text-xl text-gray-400">Calibrating your height & reach...</p>
                    </div>
                )}
            </div>

            {/* MENUS */}
            {gameState === 'IDLE' && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-lg pointer-events-auto">
                    <h1 className="text-[120px] font-black text-white mb-4 tracking-tighter italic">BOXING<span className="text-blue-500">AI</span></h1>
                    <div className="text-xl text-gray-400 mb-8 max-w-lg text-center font-medium">
                        {cameraReady ? "System Ready. Prepare for Calibration." : "Initializing Camera..."}
                    </div>
                    {cameraReady && (
                        <button onClick={startCalibration} className="bg-white text-black text-2xl font-bold px-16 py-6 rounded-full hover:bg-blue-500 hover:text-white transition-all shadow-xl hover:scale-105 flex items-center gap-3">
                            <Ruler className="w-6 h-6" />
                            CALIBRATE & FIGHT
                        </button>
                    )}
                </div>
            )}

            {gameState === 'FINISHED' && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-500 pointer-events-auto">
                    {!aiFeedback ? (
                        <>
                            <Trophy className="w-32 h-32 text-yellow-500 mb-8" />
                            <h2 className="text-4xl font-bold text-gray-400 tracking-widest uppercase mb-4">Final Score</h2>
                            <div className="text-9xl font-black text-white mb-12">{score.toLocaleString()}</div>
                            <button onClick={generateCoachingAdvice} disabled={isAnalyzing} className="group flex items-center gap-4 bg-blue-600 text-white px-12 py-6 rounded-2xl mb-6 hover:scale-105 transition-all shadow-xl">
                                {isAnalyzing ? <Loader2 className="w-8 h-8 animate-spin" /> : <BrainCircuit className="w-8 h-8" />}
                                <span className="font-bold text-xl">{isAnalyzing ? "ANALYZING..." : "COACH FEEDBACK"}</span>
                            </button>
                            <button onClick={() => { setGameState('IDLE'); setAiFeedback(""); }} className="text-gray-400 hover:text-white font-bold text-lg underline">RESTART</button>
                        </>
                    ) : (
                        <div className="max-w-4xl w-full bg-gray-900 border border-gray-700 p-12 rounded-3xl flex flex-col gap-8 shadow-2xl">
                            <div className="flex items-center gap-4 text-blue-500 mb-4 border-b border-gray-800 pb-4">
                                <Activity className="w-8 h-8" />
                                <h2 className="text-3xl font-black">COACH REPORT</h2>
                            </div>
                            <div className="prose prose-invert prose-lg max-h-[400px] overflow-y-auto"><Markdown>{aiFeedback}</Markdown></div>
                            <button onClick={() => setAiFeedback("")} className="self-end bg-white text-black font-bold px-8 py-3 rounded-lg hover:bg-blue-500">CLOSE</button>
                        </div>
                    )}
                </div>
            )}

            {/* 3D LAYER */}
            <div className="absolute inset-0 z-20 pointer-events-none">
                <Canvas shadows gl={{ antialias: true, alpha: true }} camera={{ position: [0, 0, 4] }}>
                    <Scene3D activePunchRef={activePunchRef} damage={damageFlash} speedMultiplier={speedMultiplier} />
                </Canvas>
            </div>

            {/* VIDEO BG */}
            <div ref={containerRef} className="w-full h-full relative z-0">
                <video ref={videoRef} className="hidden" playsInline />
                <canvas ref={canvasRef} className="w-full h-full object-cover opacity-30" />
            </div>
        </div>
    );
};

export default GeminiBoxingCoach;