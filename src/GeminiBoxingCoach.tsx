import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Zap, Trophy, Activity, Camera, ScanFace, BrainCircuit } from 'lucide-react';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import * as tf from '@tensorflow/tfjs';
import { GoogleGenerativeAI } from "@google/generative-ai";
import Markdown from 'markdown-to-jsx';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Environment, Circle, Stats, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// --- IMPORT CHARACTER ---
import { Opponent } from './components/Opponent';

// --- TYPES ---
export type GameState = 'IDLE' | 'CALIBRATING_DIMENSIONS' | 'TRAINING_AI' | 'PLAYING' | 'FINISHED';
export type PunchType = 'straight' | 'hook';
export type PunchSide = 'left' | 'right';
export type PunchStatus = 'flying' | 'hit' | 'dodged';
export type DodgeRating = 'NONE' | 'HIT' | 'WHIFF' | 'PERFECT' | 'CLEAN DUCK' | 'OUTSIDE!' | 'BLOCKED' | 'TOO SHALLOW' | 'LUCKY DUCK';
export type PoseClass = 'NEUTRAL' | 'LEFT' | 'RIGHT' | 'DUCK';

export interface FightEvent { time: number; punch: string; userMove: string; outcome: string; scoreDelta: number; }
export interface CalibrationData { shoulderWidth: number; centerLine: number; baselineY: number; }
export interface Punch { id: string; side: PunchSide; type: PunchType; startTime: number; duration: number; status: PunchStatus; rating?: DodgeRating; }

declare global { interface Window { Pose: any; Camera: any; } }

// --- CONFIG ---
const ROUND_TIME = 60;
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const MP_VERSION = "0.5.1675469404";

const TRAINING_STEPS: { id: PoseClass, label: string, instruction: string }[] = [
    { id: 'NEUTRAL', label: 'NEUTRAL GUARD', instruction: 'Hands at cheeks. Stand tall.' },
    { id: 'LEFT', label: 'SLIP LEFT', instruction: 'Lean Left.' },
    { id: 'RIGHT', label: 'SLIP RIGHT', instruction: 'Lean Right.' },
    { id: 'DUCK', label: 'DUCK DOWN', instruction: 'Squat VERTICALLY. Drop your level.' }
];

// --- 3D SCENE ---
const BoxingRing = () => (
    <group position={[0, -3.5, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#f0f0f0" roughness={0.5} metalness={0.1} />
        </mesh>
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

const Scene3D: React.FC<{ activePunchRef: React.RefObject<Punch | null>, damage: boolean }> = ({ activePunchRef, damage }) => {
    const [punchData, setPunchData] = useState<Punch | null>(null);
    const lastPunchId = useRef<string>("");

    useFrame(() => {
        if (activePunchRef.current && activePunchRef.current.id !== lastPunchId.current) {
            lastPunchId.current = activePunchRef.current.id;
            setPunchData({ ...activePunchRef.current });
        }
        if (!activePunchRef.current && punchData !== null) setPunchData(null);
    });

    return (
        <>
            <color attach="background" args={["#e5e5e5"]} />
            <Environment preset="city" />
            <ambientLight intensity={0.6} />
            <directionalLight position={[2, 5, 2]} intensity={1.5} castShadow />

            <PerspectiveCamera makeDefault position={[0, 1.3, 2.2]} fov={70} />

            <BoxingRing />

            <Opponent activePunch={punchData} />

            <Circle args={[10]} rotation-x={-Math.PI / 2} receiveShadow>
                <meshStandardMaterial color="#444" />
            </Circle>
            <OrbitControls target={[0, 0, 0]} />
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
    const activePunchRef = useRef<Punch | null>(null);
    const calibrationRef = useRef<CalibrationData>({ shoulderWidth: 0.1, centerLine: 0.5, baselineY: 0.5 });
    const fightLogRef = useRef<FightEvent[]>([]);
    const scoreRef = useRef<number>(0);
    const comboRef = useRef<number>(0);
    const timeLeftRef = useRef<number>(ROUND_TIME);

    // TIMING REFS
    const timerRef = useRef<number | null>(null);
    const speedMultiplierRef = useRef(1.0);
    const [speedMultiplier, setSpeedMultiplier] = useState(1.0);

    const classifierRef = useRef<knnClassifier.KNNClassifier | null>(null);
    const currentPoseLabel = useRef<PoseClass>('NEUTRAL');

    const trainingStepIndex = useRef<number>(0);
    const trainingSamples = useRef<number>(0);
    const trainingStateRef = useRef<'PREPARING' | 'RECORDING'>('PREPARING');
    const trainingTimerRef = useRef<number>(0);

    // State
    const [gameState, setGameState] = useState<GameState>('IDLE');
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const [bonusText, setBonusText] = useState<{ msg: string, color: string } | null>(null);
    const [trainingOverlay, setTrainingOverlay] = useState<{ title: string, sub: string, count: number | null, color: string } | null>(null);
    const [aiFeedback, setAiFeedback] = useState<string>("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [damageFlash, setDamageFlash] = useState(false);

    useEffect(() => { classifierRef.current = knnClassifier.create(); }, []);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

    // Sync state to ref
    useEffect(() => { speedMultiplierRef.current = speedMultiplier; }, [speedMultiplier]);

    // --- SIMPLIFIED GAME LOOP (NO LAG) ---
    const scheduleNextPunch = useCallback(() => {
        // 1. Clean up old timer
        if (timerRef.current) clearTimeout(timerRef.current);

        if (gameStateRef.current !== 'PLAYING' || timeLeftRef.current <= 0) return;

        const currentSpeed = speedMultiplierRef.current;

        // 2. Calculate Timings
        const idleDelay = (1000 + Math.random() * 1000) / currentSpeed; // Wait 1-2s between punches

        // 3. Set Timer
        timerRef.current = window.setTimeout(() => {
            if (gameStateRef.current !== 'PLAYING') return;

            // Simple Random Logic (No smart deck overhead, keeps it lightweight)
            const move: { side: PunchSide, type: PunchType } =
                Math.random() < 0.5
                    ? { side: 'left', type: 'straight' }
                    : Math.random() < 0.5
                        ? { side: 'right', type: 'straight' }
                        : Math.random() < 0.5
                            ? { side: 'left', type: 'hook' }
                            : { side: 'right', type: 'hook' };

            // Calculate exact duration so Opponent.tsx can sync perfectly
            // Base duration 1200ms (standard punch) scaled by speed
            const punchDuration = 1200 / currentSpeed;

            activePunchRef.current = {
                id: `punch-${Date.now()}-${Math.random()}`,
                side: move.side,
                type: move.type,
                startTime: performance.now(),
                duration: punchDuration,
                status: 'flying'
            };

            // Loop: Schedule next punch after this one finishes
            // We wait for the punch duration + the idle delay
            timerRef.current = window.setTimeout(scheduleNextPunch, punchDuration + 200);

        }, idleDelay);

    }, []);

    // Start/Stop Loop on Game State
    useEffect(() => {
        if (gameState === 'PLAYING') {
            scheduleNextPunch();
        } else {
            if (timerRef.current) clearTimeout(timerRef.current);
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [gameState, scheduleNextPunch]);


    const trainAI = (label: string, landmarks: any[]) => {
        if (!classifierRef.current) return;
        const nose = landmarks[0];
        const left = landmarks[11];
        const right = landmarks[12];
        const width = Math.abs(left.x - right.x);
        const features = [(nose.x - 0.5), nose.y, width];
        const tensor = tf.tensor(features);
        classifierRef.current.addExample(tensor, label);
        tensor.dispose();
    };

    const predictPose = async (landmarks: any[]) => {
        if (!classifierRef.current || classifierRef.current.getNumClasses() === 0) return;
        const nose = landmarks[0];
        const left = landmarks[11];
        const right = landmarks[12];
        const width = Math.abs(left.x - right.x);
        const features = [(nose.x - 0.5), nose.y, width];
        const tensor = tf.tensor(features);
        try {
            const result = await classifierRef.current.predictClass(tensor);
            if (result.confidences[result.label] > 0.65) currentPoseLabel.current = result.label as PoseClass;
        } catch (e) { console.warn(e); }
        tensor.dispose();
    };

    const generateCoachingAdvice = async () => {
        if (!API_KEY) { setAiFeedback("⚠️ API Key Missing."); return; }
        setIsAnalyzing(true);
        try {
            const genAI = new GoogleGenerativeAI(API_KEY);
            let model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const stats = { total: fightLogRef.current.length, hits: fightLogRef.current.filter(e => e.scoreDelta < 0).length };
            const prompt = `ROLE: Professional Boxing Coach. STATS: ${JSON.stringify(stats)}. LOG: ${JSON.stringify(fightLogRef.current)}. TASK: Provide technical feedback on head movement and reaction time.`;
            const result = await model.generateContent(prompt);
            setAiFeedback((await result.response).text());
        } catch (error) { setAiFeedback("AI Offline."); }
        setIsAnalyzing(false);
    };

    const startCalibration = () => setGameState('CALIBRATING_DIMENSIONS');
    const startAITraining = () => {
        setGameState('TRAINING_AI');
        trainingStepIndex.current = 0;
        trainingSamples.current = 0;
        trainingStateRef.current = 'PREPARING';
        trainingTimerRef.current = 3000;
    };

    useEffect(() => {
        let interval: number;
        if (gameState === 'PLAYING') {
            interval = window.setInterval(() => {
                setTimeLeft(prev => {
                    const newVal = prev - 1;
                    timeLeftRef.current = newVal;
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

                if (gameStateRef.current === 'PLAYING' || gameStateRef.current === 'FINISHED') {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                } else {
                    ctx.save();
                    ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
                    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
                    ctx.restore();
                }

                const now = performance.now();

                if (results.poseLandmarks) {
                    const landmarks = results.poseLandmarks;
                    const nose = landmarks[0];
                    const mirroredNoseX = 1.0 - nose.x;

                    if (gameStateRef.current === 'CALIBRATING_DIMENSIONS') {
                        calibrationRef.current = { shoulderWidth: 0.2, centerLine: mirroredNoseX, baselineY: nose.y };
                        ctx.strokeStyle = '#0066cc'; ctx.lineWidth = 4;
                        ctx.strokeRect((1 - nose.x) * canvas.width - 50, nose.y * canvas.height - 50, 100, 100);
                    }
                    else if (gameStateRef.current === 'TRAINING_AI') {
                        const step = TRAINING_STEPS[trainingStepIndex.current];
                        if (step) {
                            if (trainingStateRef.current === 'PREPARING') {
                                const timeLeft = Math.ceil((trainingTimerRef.current - now) / 1000);
                                if (timeLeft > 0) {
                                    setTrainingOverlay({ title: `GET READY: ${step.label}`, sub: step.instruction, count: timeLeft, color: 'text-orange-500' });
                                } else {
                                    trainingStateRef.current = 'RECORDING';
                                    setTrainingOverlay({ title: "HOLD STILL!", sub: "Scanning...", count: null, color: 'text-red-600' });
                                }
                            } else if (trainingStateRef.current === 'RECORDING') {
                                if (trainingSamples.current < 50) {
                                    trainAI(step.id, landmarks);
                                    trainingSamples.current++;
                                    const progress = (trainingSamples.current / 50) * canvas.width;
                                    ctx.fillStyle = '#10b981'; ctx.fillRect(0, canvas.height - 10, progress, 10);
                                } else {
                                    trainingStepIndex.current++;
                                    trainingSamples.current = 0;
                                    trainingStateRef.current = 'PREPARING';
                                    trainingTimerRef.current = now + 2000;
                                }
                            }
                        } else {
                            setTrainingOverlay({ title: "SYNC COMPLETE", sub: "FIGHT!", count: null, color: 'text-green-600' });
                            setTimeout(() => {
                                setTrainingOverlay(null);
                                setGameState('PLAYING');
                            }, 2000);
                        }
                    }
                    else if (gameStateRef.current === 'PLAYING') {
                        predictPose(landmarks);
                    }

                    // --- REFINED HIT LOGIC ---
                    const p = activePunchRef.current;

                    // Only check hits for flying punches
                    if (p && gameStateRef.current === 'PLAYING' && p.status === 'flying') {

                        const elapsed = now - p.startTime;
                        // PROGRESS CHECK: 0.0 = Start, 1.0 = End
                        const progress = elapsed / p.duration;

                        // HIT WINDOW: Check when punch is 80% extended
                        if (progress > 0.6 && progress < 0.8) {
                            const cal = calibrationRef.current
                            const move = currentPoseLabel.current
                            const verticalDrop = (nose.y - cal.baselineY)

                            let rating: DodgeRating = 'HIT'
                            let points = -100

                            if (p.type === 'hook') {
                                // Hooks require ducking
                                if (verticalDrop > 0.1 && move === 'DUCK') {
                                    rating = 'CLEAN DUCK'; points = 500
                                }
                            } else {
                                // Straights require dodging Left/Right
                                if ((p.side === 'left' && move === 'RIGHT') ||
                                    (p.side === 'right' && move === 'LEFT')) {
                                    rating = 'PERFECT'; points = 300
                                } else if (move === 'DUCK') {
                                    // Ducking a straight is okay but risky
                                    rating = 'LUCKY DUCK'; points = 100
                                }
                            }

                            // Commit Result
                            p.status = points < 0 ? 'hit' : 'dodged'
                            p.rating = rating

                            fightLogRef.current.push({
                                time: ROUND_TIME - timeLeft,
                                punch: `${p.side}_${p.type}`,
                                userMove: move,
                                outcome: rating,
                                scoreDelta: points
                            })

                            scoreRef.current = Math.max(0, scoreRef.current + points)
                            comboRef.current = points < 0 ? 0 : comboRef.current + 1
                            setScore(scoreRef.current)
                            setCombo(comboRef.current)

                            if (points < 0) {
                                setDamageFlash(true);
                                setTimeout(() => setDamageFlash(false), 200);
                            }

                            setBonusText({ msg: rating, color: points > 0 ? 'text-blue-600' : 'text-red-600' })
                            setTimeout(() => setBonusText(null), 800)

                            // Note: We do NOT nullify activePunchRef here.
                            // We let the animation component finish playing it visually.
                            // The status check (p.status === 'flying') prevents double scoring.
                        }
                    }

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
        <div className="w-full h-screen bg-gray-50 font-sans text-slate-900 relative select-none overflow-hidden">
            {/* UI */}
            <div className="absolute top-0 left-0 p-8 z-30 w-full flex justify-between pointer-events-none">
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
                    <div className="text-slate-500 text-xs font-bold tracking-widest uppercase mb-1">Score</div>
                    <div className="text-6xl font-black text-slate-900">{score.toLocaleString()}</div>
                </div>
                {gameState === 'PLAYING' && (
                    <div className="flex gap-4">
                        <div className="bg-white px-8 py-4 rounded-full shadow-lg border border-slate-200 flex items-center gap-2">
                            <div className="text-4xl font-black text-red-500">{timeLeft}s</div>
                        </div>
                        <div className="bg-white px-6 py-4 rounded-full shadow-lg border border-slate-200 flex items-center gap-2">
                            <Zap className="text-orange-500 w-6 h-6 fill-current" />
                            <div className="text-2xl font-bold text-slate-900">{combo}x</div>
                        </div>
                    </div>
                )}
            </div>

            {/* SPEED SLIDER UI */}
            <div className="absolute top-8 right-8 z-50 pointer-events-auto bg-white px-6 py-4 rounded-full shadow border border-slate-200">
                <div className="text-xs font-bold text-slate-500">GAME SPEED</div>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="0.6"
                        max="1.4"
                        step="0.1"
                        value={speedMultiplier}
                        onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
                        className="accent-blue-600"
                    />
                    <div className="text-sm font-bold w-10">{speedMultiplier.toFixed(1)}x</div>
                </div>
            </div>

            {/* Feedback */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none">
                {damageFlash && <div className="absolute inset-0 bg-red-500/10 mix-blend-multiply" />}
                {bonusText && <div className={`text-8xl font-black italic drop-shadow-sm scale-110 duration-75 ${bonusText.color}`}>{bonusText.msg}</div>}

                {gameState === 'TRAINING_AI' && trainingOverlay && (
                    <div className="flex flex-col items-center gap-8 animate-in zoom-in duration-100">
                        <div className={`text-6xl font-black ${trainingOverlay.color} uppercase text-center`}>{trainingOverlay.title}</div>
                        <div className="text-2xl font-bold text-slate-700 tracking-widest uppercase bg-white/90 px-8 py-4 rounded-xl shadow-lg border border-slate-200">{trainingOverlay.sub}</div>
                        {trainingOverlay.count !== null && (<div className="text-[150px] font-black text-slate-900 animate-pulse">{trainingOverlay.count}</div>)}
                        {trainingOverlay.title === "HOLD STILL!" && (<ScanFace className="w-24 h-24 text-red-500 animate-spin" />)}
                    </div>
                )}
            </div>

            {/* Menus */}
            {gameState === 'IDLE' && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm pointer-events-auto">
                    <h1 className="text-[100px] font-black text-slate-900 mb-4 tracking-tighter">BOXING<span className="text-blue-600">AI</span></h1>
                    <div className="text-xl text-slate-500 mb-8 max-w-lg text-center font-medium">
                        {cameraReady ? "Motion Tracking Ready. Stand Back." : "Initializing Camera..."}
                    </div>
                    {cameraReady && (
                        <button onClick={startCalibration} className="bg-slate-900 text-white text-2xl font-bold px-16 py-6 rounded-full hover:bg-blue-600 transition-all shadow-xl hover:shadow-2xl hover:scale-105 flex items-center gap-3">
                            <Camera className="w-6 h-6" />
                            ENTER RING
                        </button>
                    )}
                </div>
            )}

            {gameState === 'CALIBRATING_DIMENSIONS' && (
                <div className="absolute bottom-24 left-0 w-full flex justify-center z-50 pointer-events-auto">
                    <button onClick={startAITraining} className="bg-blue-600 text-white text-2xl font-bold px-12 py-4 rounded-full hover:scale-105 transition-transform shadow-lg hover:bg-blue-700">LOCK POSITION - START TRAINING</button>
                </div>
            )}

            {gameState === 'FINISHED' && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-xl animate-in fade-in duration-500 pointer-events-auto">
                    {!aiFeedback ? (
                        <>
                            <Trophy className="w-32 h-32 text-yellow-500 mb-8 drop-shadow-md" />
                            <h2 className="text-4xl font-bold text-slate-400 tracking-widest uppercase mb-4">Final Score</h2>
                            <div className="text-9xl font-black text-slate-900 mb-12">{score.toLocaleString()}</div>
                            <button onClick={generateCoachingAdvice} disabled={isAnalyzing} className="group flex items-center gap-4 bg-slate-900 text-white px-12 py-6 rounded-2xl mb-6 hover:scale-105 transition-all shadow-xl hover:bg-blue-600">
                                {isAnalyzing ? <Loader2 className="w-8 h-8 animate-spin" /> : <BrainCircuit className="w-8 h-8" />}
                                <span className="font-bold text-xl">{isAnalyzing ? "ANALYZING..." : "GET COACH FEEDBACK"}</span>
                            </button>
                            <button onClick={() => { setGameState('IDLE'); setAiFeedback(""); }} className="text-slate-400 hover:text-slate-900 font-bold text-lg underline underline-offset-8">RESTART SESSION</button>
                        </>
                    ) : (
                        <div className="max-w-4xl w-full bg-white border border-slate-200 p-12 rounded-3xl flex flex-col gap-8 shadow-2xl">
                            <div className="flex items-center gap-4 text-blue-600 mb-4 border-b border-slate-100 pb-4">
                                <Activity className="w-8 h-8" />
                                <h2 className="text-3xl font-black tracking-widest">PERFORMANCE REPORT</h2>
                            </div>
                            <div className="prose prose-slate prose-lg max-h-[400px] overflow-y-auto"><Markdown>{aiFeedback}</Markdown></div>
                            <button onClick={() => setAiFeedback("")} className="self-end bg-slate-900 text-white font-bold px-8 py-3 rounded-lg hover:bg-blue-600">CLOSE</button>
                        </div>
                    )}
                </div>
            )}

            {/* SCENE */}
            <div className="absolute inset-0 z-20 pointer-events-none">
                <Canvas shadows gl={{ antialias: true, alpha: true }} camera={{ position: [0, 0, 4] }}>
                    <Scene3D activePunchRef={activePunchRef} damage={damageFlash} />
                </Canvas>
            </div>

            {/* VIDEO BG */}
            <div ref={containerRef} className="w-full h-full relative z-0">
                <video ref={videoRef} className="hidden" playsInline />
                <canvas ref={canvasRef} className="w-full h-full object-cover" />
            </div>
        </div>
    );
};

export default GeminiBoxingCoach;