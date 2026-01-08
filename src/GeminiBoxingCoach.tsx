import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Flame, Trophy, Download, BrainCircuit, Sparkles, ScanFace, AlertTriangle } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import { GoogleGenerativeAI } from "@google/generative-ai";
import Markdown from 'markdown-to-jsx';

// --- 1. TYPES ---
export type GameState = 'IDLE' | 'CALIBRATING_DIMENSIONS' | 'TRAINING_AI' | 'PLAYING' | 'FINISHED';
export type PunchType = 'straight' | 'hook';
export type PunchSide = 'left' | 'right';
export type PunchStatus = 'flying' | 'hit' | 'dodged';
export type DodgeRating = 'NONE' | 'HIT' | 'WHIFF' | 'PERFECT' | 'CLEAN DUCK' | 'OUTSIDE!' | 'BLOCKED' | 'TOO SHALLOW' | 'LUCKY DUCK';
export type PoseClass = 'NEUTRAL' | 'LEFT' | 'RIGHT' | 'DUCK';

export interface FightEvent { time: number; punch: string; userMove: string; outcome: string; scoreDelta: number; }
export interface CalibrationData { shoulderWidth: number; centerLine: number; baselineY: number; }
export interface Punch { id: string; side: PunchSide; type: PunchType; startTime: number; duration: number; status: PunchStatus; rating?: DodgeRating; }
export interface Point { x: number; y: number; }
export interface HighScore { name: string; score: number; date: string; }

declare global { interface Window { Pose: any; Camera: any; } }

// --- 2. CONFIG ---
const ROUND_TIME = 60;
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const TRAINING_STEPS: { id: PoseClass, label: string, instruction: string }[] = [
    { id: 'NEUTRAL', label: 'NEUTRAL GUARD', instruction: 'Hands at cheeks. Stand tall.' },
    { id: 'LEFT', label: 'SLIP LEFT', instruction: 'Lean LEFT. Keep eyes forward.' },
    { id: 'RIGHT', label: 'SLIP RIGHT', instruction: 'Lean RIGHT. Keep eyes forward.' },
    { id: 'DUCK', label: 'DUCK DOWN', instruction: 'Squat VERTICALLY. Drop your level.' }
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
    const intensityRef = useRef<number>(1);
    const fightLogRef = useRef<FightEvent[]>([]);

    // AI REFS
    const classifierRef = useRef<knnClassifier.KNNClassifier | null>(null);
    const currentPoseLabel = useRef<PoseClass>('NEUTRAL');
    const currentConfidence = useRef<number>(0); // New: Track confidence
    const trainingStepIndex = useRef<number>(0);
    const trainingSamples = useRef<number>(0);
    const trainingStateRef = useRef<'PREPARING' | 'RECORDING'>('PREPARING');
    const trainingTimerRef = useRef<number>(0);
    const currentFeaturesRef = useRef<number[]>([]);

    // STATE
    const [gameState, setGameState] = useState<GameState>('IDLE');
    const [loading, setLoading] = useState(true);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const [bonusText, setBonusText] = useState<{ msg: string, color: string } | null>(null);
    const [trainingOverlay, setTrainingOverlay] = useState<{ title: string, sub: string, count: number | null, color: string } | null>(null);
    const [intensity, setIntensity] = useState(1);
    const [lowConfidenceWarning, setLowConfidenceWarning] = useState(false); // UI State for warning

    // GEN AI STATE
    const [aiFeedback, setAiFeedback] = useState<string>("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        classifierRef.current = knnClassifier.create();
    }, []);

    useEffect(() => { intensityRef.current = intensity; }, [intensity]);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

    // --- GEN AI COACHING ---
    const generateCoachingAdvice = async () => {
        if (!API_KEY) { setAiFeedback("⚠️ API Key Missing. Check .env file."); return; }
        setIsAnalyzing(true);
        try {
            const genAI = new GoogleGenerativeAI(API_KEY);
            let model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

            const totalPunches = fightLogRef.current.length;
            const hits = fightLogRef.current.filter(e => e.scoreDelta < 0).length;
            const perfects = fightLogRef.current.filter(e => e.scoreDelta > 300).length;
            const whiffs = fightLogRef.current.filter(e => e.outcome === 'WHIFF').length;
            const blocks = fightLogRef.current.filter(e => e.outcome === 'BLOCKED').length;

            const prompt = `
            ROLE: You are "CYBER COACH", an advanced boxing AI.
            STATS: Total: ${totalPunches}, Hits: ${hits}, Perfects: ${perfects}, Whiffs: ${whiffs}, Blocks: ${blocks}.
            LOG: ${JSON.stringify(fightLogRef.current)}
            TASK: 1. Archetype. 2. Biggest Flaw. 3. Two Technical Fixes.
            Tone: Gritty, Cyberpunk. Max 150 words.
            `;

            try {
                const result = await model.generateContent(prompt);
                const response = await result.response;
                setAiFeedback(response.text());
            } catch (innerError: any) {
                if (innerError.message?.includes("503")) {
                    model = genAI.getGenerativeModel({ model: "gemini-pro" });
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    setAiFeedback(response.text());
                } else throw innerError;
            }
        } catch (error) {
            console.error("AI Error:", error);
            setAiFeedback("⚠️ Neural Link Interrupted. Try again later.");
        }
        setIsAnalyzing(false);
    };

    // --- ADVANCED FEATURE ENGINEERING ---
    // Now accepts calibration data to detect True Ducks vs Neck Bends
    const calculateFeatures = (landmarks: any[], cal: CalibrationData) => {
        const nose = landmarks[0];
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];

        // 1. Dynamic Normalizer (Current Shoulder Width)
        const currentWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        const hipCenterX = (leftHip.x + rightHip.x) / 2;
        const hipCenterY = (leftHip.y + rightHip.y) / 2;
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;

        // FEATURE 1: LEAN X (Lateral Tilt)
        // Uses Spine Angle relative to vertical, more robust than just nose position
        // If spine leans, it's a slip. If spine is straight but nose drops, it's a duck.
        const leanX = (nose.x - hipCenterX) / currentWidth;

        // FEATURE 2: SQUAT METRIC (The Duck Fix)
        // Compare current nose Y to the CALIBRATED baseline Y, normalized by current width.
        // This makes "Duck" detection robust to distance changes.
        // If (nose.y - cal.baselineY) is positive and large, you are lower than before.
        const squatY = (nose.y - cal.baselineY) / currentWidth;

        // FEATURE 3: SPINE ANGLE (Geometry)
        // Helps differentiate leaning vs standing straight
        const spineDeltaX = hipCenterX - ((leftShoulder.x + rightShoulder.x) / 2);
        const spineDeltaY = hipCenterY - shoulderCenterY;
        const spineAngle = Math.atan2(spineDeltaY, spineDeltaX); // Radians

        // FEATURE 4 & 5: GUARD (Wrist Proximity)
        const guardL = Math.hypot(leftWrist.x - nose.x, leftWrist.y - nose.y) / currentWidth;
        const guardR = Math.hypot(rightWrist.x - nose.x, rightWrist.y - nose.y) / currentWidth;

        // FEATURE 6: NECK COMPRESSION (Secondary Duck Check)
        // Used to detect "turtling"
        const neckLen = (nose.y - shoulderCenterY) / currentWidth;

        return [leanX, squatY, guardL, guardR, spineAngle, neckLen];
    };

    const trainAI = (label: string, landmarks: any[]) => {
        if (!classifierRef.current) return;
        // Pass current calibration so features match gameplay
        const features = calculateFeatures(landmarks, calibrationRef.current);
        const tensor = tf.tensor(features);
        classifierRef.current.addExample(tensor, label);
        tensor.dispose();
    };

    const predictPose = async (landmarks: any[]) => {
        if (!classifierRef.current || classifierRef.current.getNumClasses() === 0) return;
        const features = calculateFeatures(landmarks, calibrationRef.current);
        currentFeaturesRef.current = features;

        const tensor = tf.tensor(features);
        try {
            const result = await classifierRef.current.predictClass(tensor);

            // CONFIDENCE CHECK
            const conf = result.confidences[result.label];
            currentConfidence.current = conf;

            // If confidence is high, update pose. If low (fuzzy), keep previous or warn.
            if (conf > 0.65) {
                currentPoseLabel.current = result.label as PoseClass;
                setLowConfidenceWarning(false);
            } else {
                setLowConfidenceWarning(true);
            }
        } catch (e) { console.warn(e); }
        tensor.dispose();
    };

    const triggerNextPunch = useCallback(() => {
        if (gameStateRef.current !== 'PLAYING') return;
        const side = Math.random() > 0.5 ? 'left' : 'right';
        const type = Math.random() > 0.3 ? 'straight' : 'hook';
        const speedMod = (intensityRef.current - 1) * 100;

        activePunchRef.current = {
            id: Math.random().toString(36),
            side: side as PunchSide,
            type: type as PunchType,
            startTime: performance.now(),
            duration: Math.max(400, 900 - speedMod),
            status: 'flying'
        };
    }, []);

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
        if (gameState === 'PLAYING' && timeLeft > 0) {
            interval = window.setInterval(() => {
                setTimeLeft(p => {
                    if (p <= 1) { setGameState('FINISHED'); activePunchRef.current = null; return 0; }
                    return p - 1;
                });
                setIntensity(Math.min(5, 1 + Math.floor(scoreRef.current / 3000)));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [gameState, timeLeft]);

    // --- MAIN RENDER LOOP ---
    useEffect(() => {
        if (!videoRef.current || !canvasRef.current || !containerRef.current) return;
        const ctx = canvasRef.current.getContext('2d', { alpha: false });
        if (!ctx) return;

        const pose = new window.Pose({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
        pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });

        // pose.onResults((results: any) => {
        //     setLoading(false);
        //     const canvas = canvasRef.current!;
        //     const container = containerRef.current!;
        //     const now = performance.now();

        //     if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
        //         canvas.width = container.clientWidth; canvas.height = container.clientHeight;
        //     }

        //     // Draw Video
        //     ctx.save();
        //     ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
        //     ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        //     ctx.restore();
        //     ctx.fillStyle = 'rgba(0, 5, 15, 0.75)'; ctx.fillRect(0, 0, canvas.width, canvas.height);

        //     if (results.poseLandmarks) {
        //         const landmarks = results.poseLandmarks;
        //         const nose = landmarks[0];
        //         const leftShoulder = landmarks[11];
        //         const rightShoulder = landmarks[12];
        //         const mirroredNoseX = 1.0 - nose.x;

        //         // --- STATE MACHINE ---
        //         if (gameStateRef.current === 'CALIBRATING_DIMENSIONS') {
        //             const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        //             calibrationRef.current = { shoulderWidth, centerLine: mirroredNoseX, baselineY: nose.y };
        //             ctx.strokeStyle = 'cyan'; ctx.lineWidth = 4;
        //             const size = shoulderWidth * canvas.width * 2;
        //             ctx.strokeRect((1 - nose.x) * canvas.width - size / 4, nose.y * canvas.height - size / 4, size / 2, size / 2);
        //         }

        //         else if (gameStateRef.current === 'TRAINING_AI') {
        //             const step = TRAINING_STEPS[trainingStepIndex.current];
        //             if (step) {
        //                 if (trainingStateRef.current === 'PREPARING') {
        //                     const timeLeft = Math.ceil((trainingTimerRef.current - now) / 1000);
        //                     if (timeLeft > 0) {
        //                         setTrainingOverlay({ title: `GET READY: ${step.label}`, sub: step.instruction, count: timeLeft, color: 'text-yellow-400' });
        //                     } else {
        //                         trainingStateRef.current = 'RECORDING';
        //                         setTrainingOverlay({ title: "HOLD STILL!", sub: "Capturing your movement...", count: null, color: 'text-red-500' });
        //                     }
        //                 }
        //                 else if (trainingStateRef.current === 'RECORDING') {
        //                     if (trainingSamples.current < 50) {
        //                         trainAI(step.id, landmarks);
        //                         trainingSamples.current++;
        //                         const progress = (trainingSamples.current / 50) * canvas.width;
        //                         ctx.fillStyle = 'lime'; ctx.fillRect(0, canvas.height - 20, progress, 20);
        //                     } else {
        //                         trainingStepIndex.current++;
        //                         trainingSamples.current = 0;
        //                         trainingStateRef.current = 'PREPARING';
        //                         trainingTimerRef.current = now + 2000;
        //                     }
        //                 }
        //             } else {
        //                 setTrainingOverlay({ title: "TRAINING COMPLETE", sub: "Get ready to fight!", count: null, color: 'text-green-400' });
        //                 setTimeout(() => {
        //                     setTrainingOverlay(null);
        //                     setGameState('PLAYING');
        //                     scoreRef.current = 0; setScore(0); setTimeLeft(ROUND_TIME); fightLogRef.current = [];
        //                     setTimeout(triggerNextPunch, 1500);
        //                 }, 2000);
        //             }
        //         }

        //         else if (gameStateRef.current === 'PLAYING') {
        //             predictPose(landmarks);
        //             ctx.font = '20px Orbitron'; ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        //             ctx.fillText(`AI: ${currentPoseLabel.current} (${Math.round(currentConfidence.current * 100)}%)`, 50, 50);
        //         }

        //         // --- PHYSICS & SCORING ---
        //         const p = activePunchRef.current;
        //         if (p && gameStateRef.current === 'PLAYING') {
        //             const elapsed = now - p.startTime;
        //             const progress = elapsed / p.duration;

        //             if (progress > 1.2) {
        //                 activePunchRef.current = null;
        //                 setTimeout(triggerNextPunch, 300);
        //             } else if (progress >= 0.85 && p.status === 'flying') {

        //                 const head = headPosRef.current;
        //                 const cal = calibrationRef.current;
        //                 const move = currentPoseLabel.current;
        //                 const currentShoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        //                 const currentShoulderY = (leftShoulder.y + rightShoulder.y) / 2;

        //                 head.x = mirroredNoseX; head.y = nose.y;

        //                 // Physics Calculations (Scale Invariant)
        //                 const distBNU_X = (head.x - cal.centerLine) / currentShoulderWidth;
        //                 const distBNU_Y = (head.y - currentShoulderY) / currentShoulderWidth;

        //                 const absDistX = Math.abs(distBNU_X);
        //                 const HIT_ZONE = 0.35;
        //                 const DEEP_DODGE = 0.8;
        //                 const DUCK_DEPTH = 0.10;

        //                 let rating: DodgeRating = 'HIT';
        //                 let points = -100;

        //                 if (p.type === 'hook') {
        //                     // HOOK LOGIC (Requires Vertical Drop)
        //                     // We use the Physics Drop (distBNU_Y) AND the AI Label for confirmation
        //                     if (distBNU_Y > DUCK_DEPTH) {
        //                         if (move === 'DUCK') { rating = 'CLEAN DUCK'; points = 500; }
        //                         else { rating = 'LUCKY DUCK'; points = 250; }
        //                     } else {
        //                         if (move === 'DUCK') { rating = 'TOO SHALLOW'; points = -50; }
        //                         else { rating = 'HIT'; points = -200; }
        //                     }
        //                 } else {
        //                     // STRAIGHT LOGIC
        //                     const isLateralDodge = absDistX > HIT_ZONE;
        //                     const isVerticalDodge = distBNU_Y > DUCK_DEPTH;

        //                     if (isLateralDodge || isVerticalDodge) {
        //                         const isOutsideSlip = (p.side === 'left' && distBNU_X > 0) || (p.side === 'right' && distBNU_X < 0);

        //                         if (move === 'DUCK' || isVerticalDodge) { rating = 'PERFECT'; points = 300; }
        //                         else if (isOutsideSlip) {
        //                             if (absDistX > DEEP_DODGE) { rating = 'OUTSIDE!'; points = 600; }
        //                             else { rating = 'PERFECT'; points = 400; }
        //                         } else { rating = 'WHIFF'; points = 50; }
        //                     } else {
        //                         // Block Logic
        //                         const features = currentFeaturesRef.current;
        //                         // Features index: 2=GuardL, 3=GuardR
        //                         const isGuardUp = features.length > 0 && (features[2] < 0.30 && features[3] < 0.30);

        //                         if (isGuardUp && move === 'NEUTRAL') { rating = 'BLOCKED'; points = 20; }
        //                         else { rating = 'HIT'; points = -100; }
        //                     }
        //                 }

        //                 fightLogRef.current.push({
        //                     time: ROUND_TIME - timeLeft,
        //                     punch: `${p.side}_${p.type}`,
        //                     userMove: move,
        //                     outcome: rating,
        //                     scoreDelta: points
        //                 });

        //                 p.status = points < 0 && rating !== 'TOO SHALLOW' ? 'hit' : 'dodged';
        //                 p.rating = rating;
        //                 scoreRef.current = Math.max(0, scoreRef.current + points);
        //                 comboRef.current = points < 0 ? 0 : comboRef.current + 1;
        //                 setScore(scoreRef.current); setCombo(comboRef.current);

        //                 let color = "text-cyan-400";
        //                 if (points < 0) color = "text-red-500";
        //                 else if (points < 100) color = "text-orange-400";

        //                 setBonusText({ msg: rating, color: color });
        //                 setTimeout(() => setBonusText(null), 800);
        //             }

        //             // --- DRAW PUNCH & SHIELD ---
        //             const centerX = canvas.width / 2; const centerY = canvas.height / 2;
        //             const radius = Math.max(10, progress * (canvas.height * 0.4));
        //             let dx = centerX;
        //             if (p.type === 'hook') dx += (p.side === 'left' ? -1 : 1) * (1 - progress) * 500;
        //             else dx += (p.side === 'left' ? -1 : 1) * (1 - progress) * 150;

        //             if (p.rating === 'BLOCKED') {
        //                 // Shield Hexagon
        //                 ctx.beginPath();
        //                 const shieldSize = radius * 1.5;
        //                 for (let i = 0; i < 6; i++) {
        //                     ctx.lineTo(dx + shieldSize * Math.cos(i * 2 * Math.PI / 6), centerY + shieldSize * Math.sin(i * 2 * Math.PI / 6));
        //                 }
        //                 ctx.closePath();
        //                 ctx.strokeStyle = 'cyan'; ctx.lineWidth = 10; ctx.stroke();
        //                 ctx.fillStyle = 'rgba(0, 255, 255, 0.3)'; ctx.fill();
        //             } else {
        //                 // Normal Punch
        //                 ctx.beginPath(); ctx.arc(dx, centerY, radius, 0, Math.PI * 2);
        //                 ctx.lineWidth = 20;
        //                 if (p.status === 'hit') ctx.strokeStyle = 'red';
        //                 else if (p.rating === 'OUTSIDE!' || p.rating === 'CLEAN DUCK') ctx.strokeStyle = '#00ff00';
        //                 else if (p.rating === 'PERFECT') ctx.strokeStyle = 'cyan';
        //                 else ctx.strokeStyle = 'orange';
        //                 ctx.stroke();
        //                 ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(dx, centerY, radius * 0.3, 0, Math.PI * 2); ctx.fill();
        //             }
        //         }
        //     }
        // });

        pose.onResults((results: any) => {
            setLoading(false);
            const canvas = canvasRef.current!;
            const container = containerRef.current!;
            const now = performance.now();

            if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
                canvas.width = container.clientWidth; canvas.height = container.clientHeight;
            }

            // Draw Video
            ctx.save();
            ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
            ctx.restore();
            ctx.fillStyle = 'rgba(0, 5, 15, 0.75)'; ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (results.poseLandmarks) {
                const landmarks = results.poseLandmarks;

                // --- 1. EXTRACT CRITICAL POINTS ---
                const nose = landmarks[0];
                const leftShoulder = landmarks[11];
                const rightShoulder = landmarks[12];
                // NEW: Get Hips for dynamic anchoring
                const leftHip = landmarks[23] || leftShoulder; // Fallback if hips not visible
                const rightHip = landmarks[24] || rightShoulder;

                const mirroredNoseX = 1.0 - nose.x;

                // --- STATE MACHINE ---
                if (gameStateRef.current === 'CALIBRATING_DIMENSIONS') {
                    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
                    calibrationRef.current = { shoulderWidth, centerLine: mirroredNoseX, baselineY: nose.y };
                    ctx.strokeStyle = 'cyan'; ctx.lineWidth = 4;
                    const size = shoulderWidth * canvas.width * 2;
                    ctx.strokeRect((1 - nose.x) * canvas.width - size / 4, nose.y * canvas.height - size / 4, size / 2, size / 2);
                }

                else if (gameStateRef.current === 'TRAINING_AI') {
                    const step = TRAINING_STEPS[trainingStepIndex.current];
                    if (step) {
                        if (trainingStateRef.current === 'PREPARING') {
                            const timeLeft = Math.ceil((trainingTimerRef.current - now) / 1000);
                            if (timeLeft > 0) {
                                setTrainingOverlay({ title: `GET READY: ${step.label}`, sub: step.instruction, count: timeLeft, color: 'text-yellow-400' });
                            } else {
                                trainingStateRef.current = 'RECORDING';
                                setTrainingOverlay({ title: "HOLD STILL!", sub: "Capturing your movement...", count: null, color: 'text-red-500' });
                            }
                        }
                        else if (trainingStateRef.current === 'RECORDING') {
                            if (trainingSamples.current < 50) {
                                trainAI(step.id, landmarks);
                                trainingSamples.current++;
                                const progress = (trainingSamples.current / 50) * canvas.width;
                                ctx.fillStyle = 'lime'; ctx.fillRect(0, canvas.height - 20, progress, 20);
                            } else {
                                trainingStepIndex.current++;
                                trainingSamples.current = 0;
                                trainingStateRef.current = 'PREPARING';
                                trainingTimerRef.current = now + 2000;
                            }
                        }
                    } else {
                        setTrainingOverlay({ title: "TRAINING COMPLETE", sub: "Get ready to fight!", count: null, color: 'text-green-400' });
                        setTimeout(() => {
                            setTrainingOverlay(null);
                            setGameState('PLAYING');
                            scoreRef.current = 0; setScore(0); setTimeLeft(ROUND_TIME); fightLogRef.current = [];
                            setTimeout(triggerNextPunch, 1500);
                        }, 2000);
                    }
                }

                else if (gameStateRef.current === 'PLAYING') {
                    predictPose(landmarks);
                    ctx.font = '20px Orbitron'; ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.fillText(`AI: ${currentPoseLabel.current}`, 50, 50);
                }

                // --- PHYSICS & SCORING ---
                const p = activePunchRef.current;
                if (p && gameStateRef.current === 'PLAYING') {
                    const elapsed = now - p.startTime;
                    const progress = elapsed / p.duration;

                    if (progress > 1.2) {
                        activePunchRef.current = null;
                        setTimeout(triggerNextPunch, 300);
                    } else if (progress >= 0.85 && p.status === 'flying') {

                        const head = headPosRef.current;
                        const move = currentPoseLabel.current;

                        // // --- THE FIX: DYNAMIC ANCHORING ---
                        // const currentShoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
                        // // Center is now Dynamic (Midpoint of Hips), ignoring Calibration
                        // // We use (1.0 - x) because of the mirror effect
                        // const hipCenterX = 1.0 - ((leftHip.x + rightHip.x) / 2);
                        // const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;

                        // // Update head pos relative to mirror
                        // head.x = mirroredNoseX; head.y = nose.y;

                        // // CALCULATE PHYSICS (Relative to Hips, not Screen Center)
                        // const distBNU_X = (head.x - hipCenterX) / currentShoulderWidth;
                        // const distBNU_Y = (head.y - shoulderCenterY) / currentShoulderWidth;

                        // const absDistX = Math.abs(distBNU_X);
                        // const HIT_ZONE = 0.35;
                        // const DEEP_DODGE = 0.8;
                        // const DUCK_DEPTH = 0.10;

                        // let rating: DodgeRating = 'HIT';
                        // let points = -100;

                        // if (p.type === 'hook') {
                        //     if (distBNU_Y > DUCK_DEPTH) {
                        //         if (move === 'DUCK') { rating = 'CLEAN DUCK'; points = 500; }
                        //         else { rating = 'LUCKY DUCK'; points = 250; }
                        //     } else {
                        //         if (move === 'DUCK') { rating = 'TOO SHALLOW'; points = -50; }
                        //         else { rating = 'HIT'; points = -200; }
                        //     }
                        // } else {
                        //     const isLateralDodge = absDistX > HIT_ZONE;
                        //     const isVerticalDodge = distBNU_Y > DUCK_DEPTH;

                        //     if (isLateralDodge || isVerticalDodge) {
                        //         const isOutsideSlip = (p.side === 'left' && distBNU_X > 0) || (p.side === 'right' && distBNU_X < 0);

                        //         if (move === 'DUCK' || isVerticalDodge) { rating = 'PERFECT'; points = 300; }
                        //         else if (isOutsideSlip) {
                        //             if (absDistX > DEEP_DODGE) { rating = 'OUTSIDE!'; points = 600; }
                        //             else { rating = 'PERFECT'; points = 400; }
                        //         } else { rating = 'WHIFF'; points = 50; }
                        //     } else {
                        //         const features = currentFeaturesRef.current;
                        //         const isGuardUp = features.length > 0 && (features[2] < 0.30 && features[3] < 0.30);
                        //         if (isGuardUp && move === 'NEUTRAL') { rating = 'BLOCKED'; points = 20; }
                        //         else { rating = 'HIT'; points = -100; }
                        //     }
                        // }

                        // 1. DYNAMIC SCALE (Scale Invariant)
                        const currentShoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

                        // 2. DYNAMIC ANCHORS (Position Invariant)
                        const hipCenterX = 1.0 - ((leftHip.x + rightHip.x) / 2);
                        const hipCenterY = (leftHip.y + rightHip.y) / 2;
                        const shoulderCenterX = 1.0 - ((leftShoulder.x + rightShoulder.x) / 2);
                        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;

                        // 3. SPINE ANGLE (Pendulum Effect Compensation)
                        // We calculate the tilt of your torso. 0 deg = Vertical.
                        const spineDeltaX = shoulderCenterX - hipCenterX;
                        const spineDeltaY = shoulderCenterY - hipCenterY;
                        const spineAngleRad = Math.atan2(spineDeltaX, -spineDeltaY);
                        const spineAngleDeg = Math.abs(spineAngleRad * (180 / Math.PI));

                        // 4. PHYSICS CALCULATIONS
                        head.x = mirroredNoseX; head.y = nose.y;

                        // Lateral: Relative to Hips (Robust to standing off-center)
                        const distBNU_X = (head.x - hipCenterX) / currentShoulderWidth;

                        // Vertical: Relative to CALIBRATED BASELINE (Fixes "Shallow" issue)
                        // We measure how far your head dropped from your STANDING height.
                        const verticalDropBNU = (head.y - calibrationRef.current.baselineY) / currentShoulderWidth;

                        const absDistX = Math.abs(distBNU_X);
                        const HIT_ZONE = 0.35;
                        const DEEP_DODGE = 0.8;

                        // 5. DYNAMIC THRESHOLDS
                        // If leaning (>15 deg), you must drop lower to count as a duck
                        // This prevents "Slips" from accidentally registering as "Ducks"
                        let DUCK_THRESHOLD = 0.12;
                        if (spineAngleDeg > 15) DUCK_THRESHOLD = 0.30;

                        let rating: DodgeRating = 'HIT';
                        let points = -100;

                        if (p.type === 'hook') {
                            // HOOK LOGIC
                            // Now compares your True World Drop against the Dynamic Threshold
                            if (verticalDropBNU > DUCK_THRESHOLD) {
                                if (move === 'DUCK') { rating = 'CLEAN DUCK'; points = 500; }
                                else { rating = 'LUCKY DUCK'; points = 250; }
                            } else {
                                if (move === 'DUCK') { rating = 'TOO SHALLOW'; points = -50; }
                                else { rating = 'HIT'; points = -200; }
                            }
                        } else {
                            // STRAIGHT LOGIC
                            const isLateralDodge = absDistX > HIT_ZONE;
                            const isVerticalDodge = verticalDropBNU > DUCK_THRESHOLD;

                            if (isLateralDodge || isVerticalDodge) {
                                const isOutsideSlip = (p.side === 'left' && distBNU_X > 0) || (p.side === 'right' && distBNU_X < 0);

                                if (move === 'DUCK' || isVerticalDodge) { rating = 'PERFECT'; points = 300; }
                                else if (isOutsideSlip) {
                                    if (absDistX > DEEP_DODGE) { rating = 'OUTSIDE!'; points = 600; }
                                    else { rating = 'PERFECT'; points = 400; }
                                } else { rating = 'WHIFF'; points = 50; }
                            } else {
                                const features = currentFeaturesRef.current;
                                // Guard check (Wrist distance to nose)
                                const isGuardUp = features.length > 0 && (features[2] < 0.30 && features[3] < 0.30);
                                if (isGuardUp && move === 'NEUTRAL') { rating = 'BLOCKED'; points = 20; }
                                else { rating = 'HIT'; points = -100; }
                            }
                        }

                        fightLogRef.current.push({
                            time: ROUND_TIME - timeLeft,
                            punch: `${p.side}_${p.type}`,
                            userMove: move,
                            outcome: rating,
                            scoreDelta: points
                        });

                        p.status = points < 0 && rating !== 'TOO SHALLOW' ? 'hit' : 'dodged';
                        p.rating = rating;
                        scoreRef.current = Math.max(0, scoreRef.current + points);
                        comboRef.current = points < 0 ? 0 : comboRef.current + 1;
                        setScore(scoreRef.current); setCombo(comboRef.current);

                        let color = "text-cyan-400";
                        if (points < 0) color = "text-red-500";
                        else if (points < 100) color = "text-orange-400";

                        setBonusText({ msg: rating, color: color });
                        setTimeout(() => setBonusText(null), 800);
                    }

                    // --- DRAW PUNCH ---
                    const centerX = canvas.width / 2; const centerY = canvas.height / 2;
                    const radius = Math.max(10, progress * (canvas.height * 0.4));
                    let dx = centerX;
                    if (p.type === 'hook') dx += (p.side === 'left' ? -1 : 1) * (1 - progress) * 500;
                    else dx += (p.side === 'left' ? -1 : 1) * (1 - progress) * 150;

                    if (p.rating === 'BLOCKED') {
                        ctx.beginPath();
                        const shieldSize = radius * 1.5;
                        for (let i = 0; i < 6; i++) {
                            ctx.lineTo(dx + shieldSize * Math.cos(i * 2 * Math.PI / 6), centerY + shieldSize * Math.sin(i * 2 * Math.PI / 6));
                        }
                        ctx.closePath();
                        ctx.strokeStyle = 'cyan'; ctx.lineWidth = 10; ctx.stroke();
                        ctx.fillStyle = 'rgba(0, 255, 255, 0.3)'; ctx.fill();
                    } else {
                        ctx.beginPath(); ctx.arc(dx, centerY, radius, 0, Math.PI * 2);
                        ctx.lineWidth = 20;
                        if (p.status === 'hit') ctx.strokeStyle = 'red';
                        else if (p.rating === 'OUTSIDE!' || p.rating === 'CLEAN DUCK') ctx.strokeStyle = '#00ff00';
                        else if (p.rating === 'PERFECT') ctx.strokeStyle = 'cyan';
                        else ctx.strokeStyle = 'orange';
                        ctx.stroke();
                        ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(dx, centerY, radius * 0.3, 0, Math.PI * 2); ctx.fill();
                    }
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
            {/* HUD */}
            <div className="absolute top-0 left-0 p-8 z-20 w-full flex justify-between">
                <div className="bg-black/60 p-6 rounded-2xl border border-cyan-500/30 backdrop-blur-md">
                    <div className="text-cyan-400 text-xs font-bold tracking-widest uppercase mb-1">Score</div>
                    <div className="text-6xl font-orbitron text-white">{score.toLocaleString()}</div>
                </div>
                {gameState === 'PLAYING' && (
                    <div className="flex gap-4">
                        <div className="bg-black/60 px-8 py-4 rounded-full border border-white/20 backdrop-blur-md">
                            <div className="text-4xl font-orbitron text-red-500">{timeLeft}s</div>
                        </div>
                        <div className="bg-black/60 px-6 py-4 rounded-full border border-orange-500/30 backdrop-blur-md flex items-center gap-2">
                            <Flame className="text-orange-500 w-6 h-6" />
                            <div className="text-2xl font-orbitron text-white">{combo}x</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Center Messages & Warnings */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                {bonusText && <div className={`text-8xl font-black font-orbitron italic drop-shadow-2xl scale-110 duration-75 ${bonusText.color}`}>{bonusText.msg}</div>}

                {lowConfidenceWarning && gameState === 'PLAYING' && !bonusText && (
                    <div className="flex items-center gap-3 bg-yellow-500/80 px-8 py-4 rounded-full animate-bounce">
                        <AlertTriangle className="text-black w-8 h-8" />
                        <span className="text-black font-bold font-orbitron text-xl">MOVE MORE CLEARLY</span>
                    </div>
                )}

                {gameState === 'TRAINING_AI' && trainingOverlay && (
                    <div className="flex flex-col items-center gap-8 animate-in zoom-in duration-100">
                        <div className={`text-6xl font-black font-orbitron ${trainingOverlay.color} drop-shadow-[0_0_20px_rgba(0,0,0,1)] uppercase text-center`}>{trainingOverlay.title}</div>
                        <div className="text-2xl font-bold text-white/80 tracking-widest uppercase bg-black/60 px-8 py-4 rounded-xl border border-white/10">{trainingOverlay.sub}</div>
                        {trainingOverlay.count !== null && (<div className="text-[150px] font-black font-orbitron text-white animate-pulse">{trainingOverlay.count}</div>)}
                        {trainingOverlay.title === "HOLD STILL!" && (<ScanFace className="w-24 h-24 text-red-500 animate-spin" />)}
                    </div>
                )}
            </div>

            {/* Start Screen */}
            {gameState === 'IDLE' && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
                    <h1 className="text-[120px] font-black font-orbitron text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-600 mb-8 italic drop-shadow-[0_0_30px_rgba(0,229,255,0.4)]">CYBER BOX</h1>
                    <button onClick={startCalibration} className="group relative bg-white text-black text-4xl font-black px-20 py-8 rounded-full hover:bg-cyan-400 transition-all font-orbitron overflow-hidden">
                        <span className="relative z-10">INITIALIZE SYSTEM</span>
                        <div className="absolute inset-0 bg-cyan-400 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
                    </button>
                </div>
            )}

            {/* Calibration */}
            {gameState === 'CALIBRATING_DIMENSIONS' && (
                <div className="absolute bottom-24 left-0 w-full flex justify-center z-50">
                    <button onClick={startAITraining} className="bg-cyan-500 text-black text-2xl font-black px-12 py-4 rounded-full font-orbitron hover:scale-105 transition-transform shadow-[0_0_30px_cyan]">CALIBRATION LOCK - START TRAINING</button>
                </div>
            )}

            {/* Game Over */}
            {gameState === 'FINISHED' && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-500 pointer-events-auto">
                    {!aiFeedback ? (
                        <>
                            <Trophy className="w-32 h-32 text-cyan-400 mb-8 drop-shadow-[0_0_50px_rgba(0,255,255,0.5)]" />
                            <h2 className="text-4xl font-orbitron text-white/50 tracking-widest uppercase mb-4">Final Score</h2>
                            <div className="text-9xl font-black font-orbitron text-white mb-12">{score.toLocaleString()}</div>

                            <button onClick={generateCoachingAdvice} disabled={isAnalyzing} className="group flex items-center gap-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-12 py-6 rounded-2xl mb-6 hover:scale-105 transition-all shadow-xl">
                                {isAnalyzing ? <Loader2 className="w-8 h-8 animate-spin" /> : <BrainCircuit className="w-8 h-8" />}
                                <span className="font-orbitron text-xl">{isAnalyzing ? "ANALYZING FIGHT DATA..." : "GET AI COACHING"}</span>
                            </button>

                            <button onClick={() => {
                                const blob = new Blob([JSON.stringify(fightLogRef.current, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a'); a.href = url; a.download = `fight_log_${new Date().toISOString()}.json`; a.click();
                            }} className="flex items-center gap-4 bg-gray-900 border border-cyan-500 text-cyan-400 px-8 py-4 rounded-xl mb-8 hover:bg-gray-800">
                                <Download className="w-6 h-6" />
                                <span className="font-orbitron">RAW DATA</span>
                            </button>
                            <button onClick={() => { setGameState('IDLE'); setAiFeedback(""); }} className="text-white/50 hover:text-white font-orbitron text-lg underline underline-offset-8">RESTART</button>
                        </>
                    ) : (
                        <div className="max-w-4xl w-full bg-gray-900/90 border border-cyan-500 p-12 rounded-3xl flex flex-col gap-8 shadow-[0_0_100px_rgba(0,255,255,0.2)]">
                            <div className="flex items-center gap-4 text-cyan-400 mb-4 border-b border-white/10 pb-4">
                                <Sparkles className="w-8 h-8" />
                                <h2 className="text-3xl font-orbitron tracking-widest">COACH GEMINI ANALYSIS</h2>
                            </div>
                            <div className="prose prose-invert prose-lg max-h-[400px] overflow-y-auto">
                                <Markdown>{aiFeedback}</Markdown>
                            </div>
                            <button onClick={() => setAiFeedback("")} className="self-end bg-white text-black font-black px-8 py-3 rounded-lg hover:bg-cyan-400 font-orbitron">CLOSE</button>
                        </div>
                    )}
                </div>
            )}

            <div ref={containerRef} className="w-full h-full relative">
                <video ref={videoRef} className="hidden" playsInline />
                <canvas ref={canvasRef} className="w-full h-full object-cover" />
            </div>

            {loading && <div className="absolute inset-0 bg-black z-[100] flex items-center justify-center text-cyan-400 font-orbitron text-2xl animate-pulse tracking-[0.5em]">INITIALIZING NEURAL LINK...</div>}
        </div>
    );
};

export default GeminiBoxingCoach;