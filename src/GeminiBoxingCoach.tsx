import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Activity, Flame, Timer, Ruler, Trophy, Gauge, Crosshair } from 'lucide-react';

// --- 1. TYPES & INTERFACES ---
export type GameState = 'IDLE' | 'CALIBRATING' | 'TRAINING' | 'FINISHED';
export type PunchType = 'straight' | 'hook';
export type PunchSide = 'left' | 'right';
export type PunchStatus = 'flying' | 'hit' | 'dodged';
export type DodgeRating = 'NONE' | 'HIT' | 'WHIFF' | 'PERFECT' | 'CLEAN DUCK' | 'OUTSIDE!';

export interface CalibrationData {
    shoulderWidth: number; // In normalized coordinates (0.0 - 1.0)
    centerLine: number;    // The 'x' coordinate of the nose when standing still
    baselineY: number;     // The 'y' coordinate of the nose
}

export interface Punch {
    id: string;
    side: PunchSide;
    type: PunchType;
    startTime: number;
    duration: number;
    status: PunchStatus;
    rating?: DodgeRating;
}

export interface Point { x: number; y: number; }
export interface HighScore { name: string; score: number; date: string; }

// GLOBAL TYPES
declare global {
    interface Window { Pose: any; Camera: any; }
}

// --- 2. PHYSICS CONSTANTS (BODY NORMALIZED UNITS - BNU) ---
const INITIAL_PUNCH_DURATION = 900;
const IMPACT_FRAME = 0.85;

// BNU THRESHOLDS (1.0 BNU = 1 Shoulder Width)
const HIT_THRESHOLD_BNU = 0.35;   // If you are within 0.35 shoulders of center -> HIT
const SLIP_THRESHOLD_BNU = 0.8;   // If you move > 0.8 shoulders -> PERFECT
const DUCK_THRESHOLD_BNU = 0.25;  // If you drop > 0.25 shoulders -> DUCK
const ROUND_TIME = 60;

const GeminiBoxingCoach: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Logic Refs
    const gameStateRef = useRef<GameState>('IDLE');
    const activePunchRef = useRef<Punch | null>(null);
    const calibrationRef = useRef<CalibrationData>({ shoulderWidth: 0.1, centerLine: 0.5, baselineY: 0.5 });
    const headPosRef = useRef<Point>({ x: 0.5, y: 0.5 });
    const scoreRef = useRef<number>(0);
    const comboRef = useRef<number>(0);
    const intensityRef = useRef<number>(1);

    // UI State
    const [gameState, setGameState] = useState<GameState>('IDLE');
    const [loading, setLoading] = useState(true);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const [playerName, setPlayerName] = useState('');
    const [leaderboard, setLeaderboard] = useState<HighScore[]>([]);
    const [bnuOffset, setBnuOffset] = useState({ x: 0, y: 0 }); // Visual Feedback
    const [bonusText, setBonusText] = useState<{ msg: string, color: string } | null>(null);
    const [intensity, setIntensity] = useState(1);

    useEffect(() => {
        const saved = localStorage.getItem('boxing_leaderboard');
        if (saved) setLeaderboard(JSON.parse(saved));
    }, []);

    useEffect(() => { intensityRef.current = intensity; }, [intensity]);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

    // --- GAME LOOP: SPAWN PUNCH ---
    const triggerNextPunch = useCallback(() => {
        if (gameStateRef.current !== 'TRAINING') return;

        const side = Math.random() > 0.5 ? 'left' : 'right';
        const type = Math.random() > 0.3 ? 'straight' : 'hook';
        const currentDuration = Math.max(500, INITIAL_PUNCH_DURATION - (intensityRef.current - 1) * 80);

        activePunchRef.current = {
            id: Math.random().toString(36),
            side: side as PunchSide,
            type: type as PunchType,
            startTime: performance.now(),
            duration: currentDuration,
            status: 'flying'
        };
    }, []);

    const startTraining = () => {
        setGameState('TRAINING');
        scoreRef.current = 0;
        comboRef.current = 0;
        setScore(0);
        setCombo(0);
        setTimeLeft(ROUND_TIME);
        setIntensity(1);
        setBonusText(null);
        activePunchRef.current = null;
        setTimeout(triggerNextPunch, 1500);
    };

    const startCalibration = () => setGameState('CALIBRATING');

    const saveScore = () => {
        const newScore: HighScore = { name: playerName || 'TRAINEE', score: scoreRef.current, date: new Date().toLocaleDateString() };
        const updated = [...leaderboard, newScore].sort((a, b) => b.score - a.score).slice(0, 5);
        setLeaderboard(updated);
        localStorage.setItem('boxing_leaderboard', JSON.stringify(updated));
        setGameState('IDLE');
        setPlayerName('');
    };

    // --- TIMER ---
    useEffect(() => {
        let interval: number;
        if (gameState === 'TRAINING' && timeLeft > 0) {
            interval = window.setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        setGameState('FINISHED');
                        activePunchRef.current = null;
                        return 0;
                    }
                    return prev - 1;
                });
                setIntensity(Math.min(5, 1 + Math.floor(scoreRef.current / 5000)));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [gameState, timeLeft]);

    // --- CORE ENGINE ---
    useEffect(() => {
        if (!videoRef.current || !canvasRef.current || !containerRef.current) return;
        const ctx = canvasRef.current.getContext('2d', { alpha: false });
        if (!ctx) return;

        // Initialize MediaPipe with Lite model for speed
        const pose = new window.Pose({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
        pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

        pose.onResults((results: any) => {
            setLoading(false);
            const canvas = canvasRef.current!;
            const container = containerRef.current!;
            const now = performance.now();

            // Auto-Resize
            if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
                canvas.width = container.clientWidth; canvas.height = container.clientHeight;
            }

            ctx.save();
            // Mirror & Draw Video
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
            ctx.restore();

            // Cyber Overlay
            ctx.fillStyle = 'rgba(0, 5, 15, 0.75)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (results.poseLandmarks) {
                const landmarks = results.poseLandmarks;
                const nose = landmarks[0];
                const leftShoulder = landmarks[11];
                const rightShoulder = landmarks[12];

                // Critical: Mirror the Nose X because we mirrored the canvas
                const mirroredNoseX = 1.0 - nose.x;

                // 1. Calculate Shoulder Width (The "Ruler" of our BNU system)
                // We use absolute distance because rotation can skew X-distance
                const shoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);

                // 2. Update Head Position
                headPosRef.current = { x: mirroredNoseX, y: nose.y };

                // 3. Calculate Real-time BNU Offsets (For Gauge & Game Logic)
                const currentCal = calibrationRef.current;
                const bnuDeltaX = (mirroredNoseX - currentCal.centerLine) / currentCal.shoulderWidth;
                const bnuDeltaY = (nose.y - currentCal.baselineY) / currentCal.shoulderWidth;

                // Update Gauge state (throttled for performance)
                if (now % 3 === 0) setBnuOffset({ x: bnuDeltaX, y: bnuDeltaY });

                // CALIBRATION LOGIC
                if (gameStateRef.current === 'CALIBRATING') {
                    // Smoothly update calibration to average user's standing position
                    calibrationRef.current = {
                        shoulderWidth: shoulderWidth, // Dynamic update
                        centerLine: mirroredNoseX,
                        baselineY: nose.y
                    };

                    // Draw visual box
                    ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
                    ctx.lineWidth = 4;
                    const boxSize = shoulderWidth * canvas.width;
                    ctx.strokeRect(
                        (1 - nose.x) * canvas.width - (boxSize / 2),
                        nose.y * canvas.height - (boxSize / 2),
                        boxSize, boxSize
                    );
                }
            }

            // GAME LOGIC
            const p = activePunchRef.current;
            if (p && gameStateRef.current === 'TRAINING') {
                const elapsed = now - p.startTime;
                const progress = elapsed / p.duration;

                if (progress > 1.2) {
                    // Punch Missed/Done
                    activePunchRef.current = null;
                    setTimeout(triggerNextPunch, 200 + Math.random() * 300);
                } else {
                    // CHECK COLLISION (Impact Frame)
                    if (progress >= IMPACT_FRAME && p.status === 'flying') {
                        const head = headPosRef.current;
                        const cal = calibrationRef.current;

                        // Convert raw distance to BNU (Body Normalized Units)
                        // If BNU is 1.0, you moved exactly one shoulder-width away.
                        const distBNU_X = (head.x - cal.centerLine) / cal.shoulderWidth;
                        const distBNU_Y = (head.y - cal.baselineY) / cal.shoulderWidth;

                        let rating: DodgeRating = 'NONE';
                        let points = 0;

                        // --- NEW LOGIC: DIRECTIONAL CORRECTNESS ---

                        if (p.type === 'hook') {
                            // Hook requires DUCKING (Positive Y movement means going down in screen coords)
                            if (distBNU_Y > DUCK_THRESHOLD_BNU) {
                                rating = 'CLEAN DUCK'; points = 500;
                            } else {
                                rating = 'HIT'; points = -200;
                            }
                        } else {
                            // Straight Punch requires SLIPPING
                            // Logic: You should slip AWAY from the punch direction.
                            // If Punch comes from Left -> Move Right (Positive X)
                            // If Punch comes from Right -> Move Left (Negative X)

                            const movedRight = distBNU_X > 0;
                            const punchFromLeft = p.side === 'left';
                            const correctDirection = (punchFromLeft && movedRight) || (!punchFromLeft && !movedRight);

                            const absDist = Math.abs(distBNU_X);

                            if (absDist < HIT_THRESHOLD_BNU) {
                                rating = 'HIT'; points = -100;
                            } else if (absDist > SLIP_THRESHOLD_BNU) {
                                if (correctDirection) {
                                    rating = 'OUTSIDE!'; points = 600; // Bonus for correct side
                                } else {
                                    rating = 'PERFECT'; points = 300; // Still dodged, but inside
                                }
                            } else {
                                rating = 'WHIFF'; points = 50; // Barely dodged
                            }
                        }

                        p.status = points < 0 ? 'hit' : 'dodged';
                        p.rating = rating;

                        scoreRef.current = Math.max(0, scoreRef.current + points);
                        comboRef.current = points < 0 ? 0 : comboRef.current + 1;
                        setScore(scoreRef.current);
                        setCombo(comboRef.current);
                        setBonusText({ msg: rating, color: points < 0 ? "text-red-500" : "text-cyan-400" });
                        setTimeout(() => setBonusText(null), 800);
                    }

                    // DRAW PUNCH
                    const centerX = canvas.width / 2;
                    const centerY = canvas.height / 2;
                    // Radius grows based on progress
                    const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;
                    const radius = Math.max(10, progress * maxRadius);

                    // X-Offset for origin (Hooks come from wider angles)
                    let drawX = centerX;
                    const sideMultiplier = p.side === 'left' ? -1 : 1;

                    if (p.type === 'hook') {
                        drawX += sideMultiplier * (1 - progress) * 600;
                    } else {
                        drawX += sideMultiplier * (1 - progress) * 150;
                    }

                    ctx.beginPath();
                    ctx.arc(drawX, centerY, radius, 0, Math.PI * 2);
                    ctx.lineWidth = 15 * (1 + progress);

                    // Colors
                    if (p.status === 'hit') ctx.strokeStyle = `rgba(255, 0, 0, ${1 - progress})`;
                    else if (p.status === 'dodged') ctx.strokeStyle = `rgba(0, 255, 0, ${1 - progress})`;
                    else ctx.strokeStyle = p.type === 'hook' ? `rgba(255, 165, 0, ${progress})` : `rgba(0, 229, 255, ${progress})`;

                    // Glow Effect
                    ctx.shadowBlur = 40 * progress;
                    ctx.shadowColor = ctx.strokeStyle as string;
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    // Core
                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.beginPath();
                    ctx.arc(drawX, centerY, radius * 0.2, 0, Math.PI * 2);
                    ctx.fill();
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

    // --- RENDER UI ---
    return (
        <div className="w-full h-screen bg-[#000510] overflow-hidden font-roboto text-white relative select-none">
            <div ref={containerRef} className="w-full h-full relative bg-black overflow-hidden shadow-[inset_0_0_100px_rgba(0,229,255,0.1)]">

                {/* VIDEO & CANVAS */}
                <video ref={videoRef} className="hidden" playsInline />
                <canvas ref={canvasRef} className="w-full h-full object-cover" />

                {/* HUD */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 z-20">

                    {/* TOP BAR */}
                    <div className="flex justify-between items-start">
                        <div className="bg-black/60 backdrop-blur-md p-6 rounded-[2rem] border border-cyan-500/30 flex flex-col shadow-[0_0_30px_rgba(0,229,255,0.2)]">
                            <div className="flex items-center gap-3 mb-1"><Activity className="w-4 h-4 text-cyan-400 animate-pulse" /><div className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em]">Synapse Link</div></div>
                            <span className="text-6xl font-black font-orbitron tabular-nums tracking-tighter text-white drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]">{score.toLocaleString()}</span>
                        </div>

                        <div className="flex flex-col items-end gap-4">
                            <div className="bg-black/60 backdrop-blur-md px-8 py-4 rounded-full border border-cyan-500/30 flex items-center gap-4 shadow-lg">
                                <Timer className={`w-8 h-8 ${timeLeft < 10 ? 'text-red-500 animate-ping' : 'text-cyan-400'}`} />
                                <span className={`text-5xl font-black font-orbitron tabular-nums tracking-tight ${timeLeft < 10 ? 'text-red-500' : 'text-white'}`}>{timeLeft}s</span>
                            </div>
                            <div className="flex gap-4">
                                <div className={`backdrop-blur-md px-6 py-3 rounded-full border flex items-center gap-3 transition-all ${combo > 5 ? 'bg-orange-500/20 border-orange-500 scale-110' : 'bg-black/40 border-white/10'}`}>
                                    <Flame className={`w-6 h-6 ${combo > 5 ? 'text-orange-500 fill-orange-500' : 'text-white/20'}`} />
                                    <span className="text-2xl font-black font-orbitron italic text-white">{combo}x</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CENTER TEXT */}
                    <div className="flex flex-col items-center justify-center flex-1">
                        {bonusText && (
                            <div className={`text-8xl font-black font-orbitron uppercase tracking-widest italic animate-in zoom-in duration-100 drop-shadow-[0_0_50px_rgba(0,0,0,1)] ${bonusText.color}`}>
                                {bonusText.msg}
                            </div>
                        )}
                    </div>

                    {/* ALIGNMENT GAUGE (Updated for BNU) */}
                    <div className="flex flex-col items-center gap-2 mb-8 bg-black/40 backdrop-blur-md p-6 rounded-full border border-white/5 max-w-fit mx-auto transition-opacity duration-500">
                        <div className="flex items-center gap-4 text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">
                            <span>Left</span> <Crosshair className="w-4 h-4" /> <span>Right</span>
                        </div>
                        <div className="w-[400px] h-2 bg-white/10 rounded-full overflow-hidden flex items-center relative">
                            {/* Center Safe Zone Marker (0.3 BNU) */}
                            <div className="absolute left-1/2 -translate-x-1/2 w-[30%] h-full bg-red-500/20 z-10" />
                            <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-4 bg-cyan-400/50 z-20" />

                            {/* Player Dot */}
                            <div
                                className={`w-6 h-6 rounded-full shadow-[0_0_15px_currentColor] border-2 border-white transition-all duration-75 absolute top-1/2 -translate-y-1/2 z-30 ${Math.abs(bnuOffset.x) < HIT_THRESHOLD_BNU ? 'bg-red-500 text-red-500' : 'bg-green-400 text-green-400'}`}
                                // 1.5 BNU range mapped to 100% width
                                style={{ left: `${50 + (bnuOffset.x * 33)}%` }}
                            />
                        </div>
                        <div className="text-[9px] font-black uppercase tracking-[0.5em] text-cyan-400/50">Spatial Alignment (BNU)</div>
                    </div>
                </div>

                {/* MENUS */}
                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                    {gameState === 'IDLE' && (
                        <div className="pointer-events-auto flex flex-col items-center gap-12 animate-in fade-in zoom-in duration-500">
                            <h1 className="text-8xl font-black font-orbitron text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-600 drop-shadow-[0_0_30px_rgba(0,229,255,0.4)] tracking-tighter italic">
                                CYBER BOX
                            </h1>
                            <button onClick={startCalibration} className="bg-white text-black font-black px-16 py-6 rounded-full text-3xl hover:bg-cyan-400 transition-all font-orbitron shadow-[0_0_50px_rgba(0,229,255,0.3)] hover:scale-110 active:scale-95 tracking-widest">
                                INITIALIZE
                            </button>
                            {leaderboard.length > 0 && (
                                <div className="bg-black/80 backdrop-blur-md p-8 rounded-3xl border border-white/10 w-[400px]">
                                    <div className="text-cyan-400 font-orbitron text-sm tracking-[0.3em] mb-4 text-center">TOP AGENTS</div>
                                    {leaderboard.map((e, i) => (
                                        <div key={i} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                                            <span className="text-white/70 font-bold">{e.name}</span>
                                            <span className="text-cyan-400 font-orbitron">{e.score}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {gameState === 'CALIBRATING' && (
                        <div className="pointer-events-auto flex flex-col items-center gap-8 animate-in zoom-in duration-300">
                            <div className="p-12 bg-black/80 backdrop-blur-xl border border-cyan-500/50 rounded-[3rem] flex flex-col items-center gap-6 shadow-[0_0_100px_rgba(0,229,255,0.2)]">
                                <Ruler className="text-cyan-400 w-16 h-16 animate-pulse" />
                                <div className="text-center">
                                    <span className="text-cyan-400 font-black tracking-[0.3em] uppercase text-2xl block mb-2">Calibrating Sensors</span>
                                    <span className="text-white/50 text-xs font-bold uppercase tracking-[0.5em]">Stand Center & Still</span>
                                </div>
                                <button onClick={startTraining} className="bg-cyan-500 text-black font-black px-12 py-4 rounded-full text-xl hover:scale-105 active:scale-95 transition-all font-orbitron mt-4">
                                    LOCK IN
                                </button>
                            </div>
                        </div>
                    )}

                    {gameState === 'FINISHED' && (
                        <div className="pointer-events-auto fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-8">
                            <div className="max-w-2xl w-full flex flex-col items-center text-center animate-in slide-in-from-bottom-10 duration-500">
                                <Trophy className="w-24 h-24 text-cyan-400 mb-8 drop-shadow-[0_0_30px_rgba(34,211,238,0.6)]" />
                                <h2 className="text-6xl font-black font-orbitron mb-4 text-white tracking-tighter">SIMULATION OVER</h2>

                                <div className="bg-gradient-to-b from-white/10 to-transparent border border-white/10 p-12 rounded-[3rem] w-full mb-8">
                                    <div className="text-8xl font-black font-orbitron text-cyan-400 mb-8 tracking-tighter drop-shadow-[0_0_20px_rgba(0,229,255,0.5)]">
                                        {score.toLocaleString()}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="ENTER CALLSIGN"
                                        autoFocus
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value.toUpperCase().slice(0, 10))}
                                        className="w-full bg-black/50 border-2 border-white/10 focus:border-cyan-400 rounded-2xl py-6 text-3xl font-black font-orbitron text-center text-white outline-none transition-colors uppercase placeholder:text-white/20"
                                    />
                                </div>

                                <div className="flex gap-4 w-full">
                                    <button onClick={saveScore} className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-black py-6 rounded-2xl font-orbitron text-xl transition-all">
                                        SAVE DATA
                                    </button>
                                    <button onClick={startTraining} className="flex-1 bg-white hover:bg-gray-200 text-black font-black py-6 rounded-2xl font-orbitron text-xl transition-all">
                                        RESTART
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {loading && (
                    <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-50">
                        <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mb-8" />
                        <p className="font-orbitron tracking-[0.5em] text-xl opacity-60 animate-pulse text-cyan-400 uppercase">System Booting...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeminiBoxingCoach;