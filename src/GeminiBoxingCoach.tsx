import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Activity, Flame, Timer, Trophy, ShieldAlert, BrainCircuit, Download } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as knnClassifier from '@tensorflow-models/knn-classifier';

// --- 1. TYPES & LOGGING ---
export type GameState = 'IDLE' | 'CALIBRATING_DIMENSIONS' | 'TRAINING_AI' | 'PLAYING' | 'FINISHED';
export type PunchType = 'straight' | 'hook';
export type PunchSide = 'left' | 'right';
export type PunchStatus = 'flying' | 'hit' | 'dodged';
export type DodgeRating = 'NONE' | 'HIT' | 'WHIFF' | 'PERFECT' | 'CLEAN DUCK' | 'OUTSIDE!';
export type PoseClass = 'NEUTRAL' | 'LEFT' | 'RIGHT' | 'DUCK';

// The Data Structure for the LLM
export interface FightEvent {
    time: number;
    punch: string;
    userMove: string; // What the AI saw you do
    outcome: string;
    scoreDelta: number;
}

export interface CalibrationData { shoulderWidth: number; centerLine: number; baselineY: number; }
export interface Punch { id: string; side: PunchSide; type: PunchType; startTime: number; duration: number; status: PunchStatus; rating?: DodgeRating; }
export interface Point { x: number; y: number; }
export interface HighScore { name: string; score: number; date: string; }

declare global { interface Window { Pose: any; Camera: any; } }

// --- 2. CONFIG ---
const ROUND_TIME = 60;
const TRAINING_STEPS: { id: PoseClass, label: string }[] = [
    { id: 'NEUTRAL', label: 'STAND NEUTRAL (GUARD UP)' },
    { id: 'LEFT', label: 'LEAN LEFT (SLIP)' },
    { id: 'RIGHT', label: 'LEAN RIGHT (SLIP)' },
    { id: 'DUCK', label: 'SQUAT DOWN (DUCK)' }
];

const GeminiBoxingCoach: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // LOGIC REFS
    const gameStateRef = useRef<GameState>('IDLE');
    const activePunchRef = useRef<Punch | null>(null);
    const calibrationRef = useRef<CalibrationData>({ shoulderWidth: 0.1, centerLine: 0.5, baselineY: 0.5 });
    const headPosRef = useRef<Point>({ x: 0.5, y: 0.5 });
    const scoreRef = useRef<number>(0);
    const comboRef = useRef<number>(0);

    // AI & DATA REFS
    const classifierRef = useRef<knnClassifier.KNNClassifier | null>(null);
    const currentPoseLabel = useRef<PoseClass>('NEUTRAL');
    const trainingStepIndex = useRef<number>(0);
    const trainingSamples = useRef<number>(0);
    const fightLogRef = useRef<FightEvent[]>([]); // <--- THIS STORES DATA FOR LLM

    // STATE
    const [gameState, setGameState] = useState<GameState>('IDLE');
    const [loading, setLoading] = useState(true);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const [playerName, setPlayerName] = useState('');
    const [leaderboard, setLeaderboard] = useState<HighScore[]>([]);
    const [bnuOffset, setBnuOffset] = useState({ x: 0, y: 0 });
    const [bonusText, setBonusText] = useState<{ msg: string, color: string } | null>(null);
    const [trainingMsg, setTrainingMsg] = useState<string>('');
    const [currentMoveUI, setCurrentMoveUI] = useState<string>('NEUTRAL'); // For Debug UI

    useEffect(() => {
        const saved = localStorage.getItem('boxing_leaderboard');
        if (saved) setLeaderboard(JSON.parse(saved));
        classifierRef.current = knnClassifier.create();
    }, []);

    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

    // --- GAME LOOP ---
    const triggerNextPunch = useCallback(() => {
        if (gameStateRef.current !== 'PLAYING') return;
        const side = Math.random() > 0.5 ? 'left' : 'right';
        const type = Math.random() > 0.3 ? 'straight' : 'hook';
        // Speed increases with score
        const speedMod = Math.min(400, Math.floor(scoreRef.current / 1000) * 50);

        activePunchRef.current = {
            id: Math.random().toString(36),
            side: side as PunchSide,
            type: type as PunchType,
            startTime: performance.now(),
            duration: Math.max(500, 900 - speedMod),
            status: 'flying'
        };
    }, []);

    const startCalibration = () => setGameState('CALIBRATING_DIMENSIONS');

    // --- AI LOGIC ---
    const trainAI = (label: string, landmarks: any[]) => {
        if (!classifierRef.current) return;
        // Train on Shoulders(11,12) and Nose(0) relationship
        const keyPoints = [0, 11, 12];
        const features = keyPoints.flatMap(i => [landmarks[i].x, landmarks[i].y]);
        const tensor = tf.tensor(features);
        classifierRef.current.addExample(tensor, label);
        tensor.dispose();
    };

    const predictPose = async (landmarks: any[]) => {
        if (!classifierRef.current || classifierRef.current.getNumClasses() === 0) return;
        const keyPoints = [0, 11, 12];
        const features = keyPoints.flatMap(i => [landmarks[i].x, landmarks[i].y]);
        const tensor = tf.tensor(features);
        try {
            const result = await classifierRef.current.predictClass(tensor);
            // Confidence check: Only switch if confidence > 0.8
            if (result.confidences[result.label] > 0.7) {
                currentPoseLabel.current = result.label as PoseClass;
                setCurrentMoveUI(result.label);
            }
        } catch (e) { console.warn(e); }
        tensor.dispose();
    };

    // --- TIMER ---
    useEffect(() => {
        let interval: number;
        if (gameState === 'PLAYING' && timeLeft > 0) {
            interval = window.setInterval(() => {
                setTimeLeft(p => {
                    if (p <= 1) { setGameState('FINISHED'); activePunchRef.current = null; return 0; }
                    return p - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [gameState, timeLeft]);

    // --- RENDER LOOP ---
    useEffect(() => {
        if (!videoRef.current || !canvasRef.current || !containerRef.current) return;
        const ctx = canvasRef.current.getContext('2d', { alpha: false });
        if (!ctx) return;

        const pose = new window.Pose({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
        pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });

        pose.onResults((results: any) => {
            setLoading(false);
            const canvas = canvasRef.current!;
            const container = containerRef.current!;
            const now = performance.now();

            if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
                canvas.width = container.clientWidth; canvas.height = container.clientHeight;
            }

            ctx.save();
            ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
            ctx.restore();
            ctx.fillStyle = 'rgba(0, 5, 15, 0.75)'; ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (results.poseLandmarks) {
                const landmarks = results.poseLandmarks;
                const nose = landmarks[0];
                const leftShoulder = landmarks[11];
                const rightShoulder = landmarks[12];
                const mirroredNoseX = 1.0 - nose.x;
                const shoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);

                // Calibration Logic
                if (gameStateRef.current === 'CALIBRATING_DIMENSIONS') {
                    calibrationRef.current = { shoulderWidth, centerLine: mirroredNoseX, baselineY: nose.y };
                    ctx.strokeStyle = 'cyan'; ctx.lineWidth = 4;
                    const size = shoulderWidth * canvas.width;
                    ctx.strokeRect((1 - nose.x) * canvas.width - size / 2, nose.y * canvas.height - size / 2, size, size);
                }

                // AI Training Logic
                else if (gameStateRef.current === 'TRAINING_AI') {
                    const step = TRAINING_STEPS[trainingStepIndex.current];
                    if (step) {
                        setTrainingMsg(step.label);
                        trainAI(step.id, landmarks);
                        trainingSamples.current++;

                        // Collect 50 samples per pose, then advance
                        if (trainingSamples.current > 40) {
                            trainingStepIndex.current++;
                            trainingSamples.current = 0;
                        }
                        // Progress Bar
                        const totalProgress = ((trainingStepIndex.current * 40 + trainingSamples.current) / (4 * 40)) * canvas.width;
                        ctx.fillStyle = 'lime'; ctx.fillRect(0, canvas.height - 10, totalProgress, 10);
                    } else {
                        setTrainingMsg("TRAINING COMPLETE!");
                        setTimeout(() => {
                            setGameState('PLAYING');
                            scoreRef.current = 0; setScore(0); setTimeLeft(ROUND_TIME); fightLogRef.current = [];
                            setTimeout(triggerNextPunch, 1500);
                        }, 1000);
                    }
                }

                // Gameplay Logic
                else if (gameStateRef.current === 'PLAYING') {
                    predictPose(landmarks); // Update currentPoseLabel

                    // Visual Debugger for detected pose
                    ctx.font = '30px Orbitron'; ctx.fillStyle = 'white';
                    ctx.fillText(`DETECTED: ${currentPoseLabel.current}`, 50, 50);
                }

                // --- GAME PHYSICS & SCORING ---
                const p = activePunchRef.current;
                if (p && gameStateRef.current === 'PLAYING') {
                    const elapsed = now - p.startTime;
                    const progress = elapsed / p.duration;

                    if (progress > 1.2) {
                        activePunchRef.current = null;
                        setTimeout(triggerNextPunch, 300);
                    } else if (progress >= 0.85 && p.status === 'flying') {
                        // COLLISION / JUDGEMENT MOMENT
                        const move = currentPoseLabel.current;
                        let rating: DodgeRating = 'HIT';
                        let points = -100;

                        // LOGIC: Did the AI see the correct move?
                        if (p.type === 'hook') {
                            // Hook -> Needs Duck
                            if (move === 'DUCK') { rating = 'CLEAN DUCK'; points = 500; }
                            else { rating = 'HIT'; points = -200; }
                        } else {
                            // Straight -> Needs Slip
                            if (p.side === 'left' && move === 'RIGHT') { rating = 'OUTSIDE!'; points = 600; }
                            else if (p.side === 'right' && move === 'LEFT') { rating = 'OUTSIDE!'; points = 600; }
                            else if (move === 'DUCK') { rating = 'PERFECT'; points = 300; } // Ducking straight is okay too
                            else if (move === 'NEUTRAL') { rating = 'HIT'; points = -100; }
                            else { rating = 'WHIFF'; points = 50; } // Wrong slip direction
                        }

                        // --- DATA LOGGING FOR LLM ---
                        fightLogRef.current.push({
                            time: ROUND_TIME - timeLeft,
                            punch: `${p.side}_${p.type}`,
                            userMove: move,
                            outcome: rating,
                            scoreDelta: points
                        });

                        p.status = points < 0 ? 'hit' : 'dodged';
                        p.rating = rating;
                        scoreRef.current = Math.max(0, scoreRef.current + points);
                        comboRef.current = points < 0 ? 0 : comboRef.current + 1;
                        setScore(scoreRef.current); setCombo(comboRef.current);
                        setBonusText({ msg: rating, color: points < 0 ? "text-red-500" : "text-cyan-400" });
                        setTimeout(() => setBonusText(null), 800);
                    }

                    // Draw Punch (Simple Logic for brevity)
                    const centerX = canvas.width / 2; const centerY = canvas.height / 2;
                    const radius = Math.max(10, progress * (canvas.height * 0.4));
                    let dx = centerX;
                    if (p.type === 'hook') dx += (p.side === 'left' ? -1 : 1) * (1 - progress) * 500;
                    ctx.beginPath(); ctx.arc(dx, centerY, radius, 0, Math.PI * 2);
                    ctx.lineWidth = 20;
                    ctx.strokeStyle = p.status === 'hit' ? 'red' : p.status === 'dodged' ? 'lime' : 'cyan';
                    ctx.stroke();
                }
            }
        });

        const cameraInstance = new window.Camera(videoRef.current, {
            onFrame: async () => { if (videoRef.current) await pose.send({ image: videoRef.current }); },
            width: 1280, height: 720
        });
        cameraInstance.start();
        return () => { cameraInstance.stop(); pose.close(); };
    }, [triggerNextPunch]);

    // --- UI RENDER ---
    return (
        <div className="w-full h-screen bg-[#000510] font-roboto text-white relative select-none overflow-hidden">
            {/* HUD Overlay */}
            <div className="absolute top-0 left-0 p-8 z-20 w-full flex justify-between">
                <div className="bg-black/60 p-6 rounded-2xl border border-cyan-500/30">
                    <div className="text-cyan-400 text-xs font-bold tracking-widest uppercase mb-1">Score</div>
                    <div className="text-6xl font-orbitron text-white">{score.toLocaleString()}</div>
                </div>
                {gameState === 'PLAYING' && (
                    <div className="bg-black/60 px-8 py-4 rounded-full border border-white/20">
                        <div className="text-4xl font-orbitron">{timeLeft}s</div>
                    </div>
                )}
            </div>

            {/* Center Messages */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                {bonusText && <div className={`text-8xl font-black font-orbitron italic ${bonusText.color}`}>{bonusText.msg}</div>}
                {trainingMsg && <div className="text-6xl font-black font-orbitron text-white bg-black/80 px-8 py-4 rounded-xl">{trainingMsg}</div>}
            </div>

            {/* Start Screen */}
            {gameState === 'IDLE' && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90">
                    <h1 className="text-9xl font-black font-orbitron text-cyan-400 mb-8 italic">CYBER BOX</h1>
                    <button onClick={startCalibration} className="bg-white text-black text-4xl font-black px-16 py-6 rounded-full hover:bg-cyan-400 transition-all font-orbitron">ENTER DOJO</button>
                </div>
            )}

            {/* Calibration */}
            {gameState === 'CALIBRATING_DIMENSIONS' && (
                <div className="absolute bottom-20 left-0 w-full flex justify-center z-50">
                    <button onClick={() => { setGameState('TRAINING_AI'); trainingStepIndex.current = 0; trainingSamples.current = 0; }} className="bg-cyan-500 text-black text-2xl font-black px-12 py-4 rounded-full font-orbitron">START AI CALIBRATION</button>
                </div>
            )}

            {/* Game Over / Export Screen */}
            {gameState === 'FINISHED' && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl">
                    <Trophy className="w-24 h-24 text-cyan-400 mb-4" />
                    <div className="text-8xl font-orbitron text-white mb-8">{score.toLocaleString()}</div>

                    {/* EXPORT DATA BUTTON */}
                    <button onClick={() => {
                        const blob = new Blob([JSON.stringify(fightLogRef.current, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = 'fight_data.json'; a.click();
                    }} className="flex items-center gap-4 bg-gray-800 border border-cyan-500 text-cyan-400 px-8 py-4 rounded-xl mb-8 hover:bg-gray-700">
                        <Download className="w-6 h-6" />
                        <span className="font-orbitron">DOWNLOAD AI FIGHT LOG</span>
                    </button>

                    <button onClick={() => { setGameState('IDLE'); }} className="bg-white text-black px-12 py-4 rounded-full font-black font-orbitron text-xl">RESTART</button>
                </div>
            )}

            <div ref={containerRef} className="w-full h-full relative">
                <video ref={videoRef} className="hidden" playsInline />
                <canvas ref={canvasRef} className="w-full h-full object-cover" />
            </div>

            {loading && <div className="absolute inset-0 bg-black z-[100] flex items-center justify-center text-cyan-400 font-orbitron text-2xl animate-pulse">LOADING NEURAL ENGINE...</div>}
        </div>
    );
};

export default GeminiBoxingCoach;