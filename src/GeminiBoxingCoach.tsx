import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Activity, Flame, Timer, Ruler, Trophy } from 'lucide-react';

// --- 1. DEFINING TYPES INSIDE THIS FILE TO FIX IMPORT ERRORS ---
export type GameState = 'IDLE' | 'CALIBRATING' | 'TRAINING' | 'FINISHED';
export type PunchType = 'straight' | 'hook';
export type PunchSide = 'left' | 'right';
export type PunchStatus = 'flying' | 'hit' | 'dodged';
export type DodgeRating = 'NONE' | 'HIT' | 'WHIFF' | 'PERFECT' | 'CLEAN DUCK' | 'OUTSIDE!';

export interface CalibrationData {
    shoulderWidth: number;
    centerLine: number;
    baselineY: number;
}

export interface Punch {
    id: string;
    side: PunchSide;
    type: PunchType;
    startTime: number;
    duration: number; // ms
    status: PunchStatus;
    rating?: DodgeRating;
}

export interface Point {
    x: number;
    y: number;
}

export interface HighScore {
    name: string;
    score: number;
    date: string;
}

// GLOBAL TYPES FOR MEDIAPIPE (Loaded via CDN)
declare global {
    interface Window { Pose: any; Camera: any; }
}

// --- 2. CONFIGURATION ---
const INITIAL_PUNCH_DURATION = 900;
const IMPACT_FRAME = 0.85;
const HIT_BNU_X = 0.35;
const SLIP_BNU_X = 1.0;
const DUCK_BNU_Y = 0.25;
const ROUND_TIME = 60;

// --- 3. MAIN COMPONENT ---
const GeminiBoxingCoach: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const gameStateRef = useRef<GameState>('IDLE');
    const activePunchRef = useRef<Punch | null>(null);
    const calibrationRef = useRef<CalibrationData>({ shoulderWidth: 0.2, centerLine: 0.5, baselineY: 0.5 });
    const headPosRef = useRef<Point>({ x: 0.5, y: 0.5 });
    const scoreRef = useRef<number>(0);
    const comboRef = useRef<number>(0);
    const intensityRef = useRef<number>(1);

    const [gameState, setGameState] = useState<GameState>('IDLE');
    const [loading, setLoading] = useState(true);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const [playerName, setPlayerName] = useState('');
    const [leaderboard, setLeaderboard] = useState<HighScore[]>([]);
    const [bnuOffset, setBnuOffset] = useState({ x: 0, y: 0 });
    const [bonusText, setBonusText] = useState<{ msg: string, color: string } | null>(null);
    const [intensity, setIntensity] = useState(1);

    useEffect(() => {
        const saved = localStorage.getItem('boxing_leaderboard');
        if (saved) setLeaderboard(JSON.parse(saved));
    }, []);

    useEffect(() => { intensityRef.current = intensity; }, [intensity]);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

    const triggerNextPunch = useCallback(() => {
        if (gameStateRef.current !== 'TRAINING') return;

        const side = Math.random() > 0.5 ? 'left' : 'right';
        const type = Math.random() > 0.3 ? 'straight' : 'hook';
        const currentDuration = Math.max(500, INITIAL_PUNCH_DURATION - (intensityRef.current - 1) * 80);

        activePunchRef.current = {
            id: Math.random().toString(36),
            side: side,
            type: type,
            startTime: performance.now(),
            duration: currentDuration,
            status: 'flying'
        };
    }, []);

    const startTraining = () => {
        setGameState('TRAINING');
        scoreRef.current = 0; comboRef.current = 0; setScore(0); setCombo(0);
        setTimeLeft(ROUND_TIME); setIntensity(1); setBonusText(null); activePunchRef.current = null;
        setTimeout(triggerNextPunch, 1500);
    };

    const startCalibration = () => setGameState('CALIBRATING');

    const saveScore = () => {
        const newScore: HighScore = { name: playerName || 'TRAINEE', score: scoreRef.current, date: new Date().toLocaleDateString() };
        const updated = [...leaderboard, newScore].sort((a, b) => b.score - a.score).slice(0, 5);
        setLeaderboard(updated);
        localStorage.setItem('boxing_leaderboard', JSON.stringify(updated));
        setGameState('IDLE'); setPlayerName('');
    };

    useEffect(() => {
        let interval: number;
        if (gameState === 'TRAINING' && timeLeft > 0) {
            interval = window.setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) { setGameState('FINISHED'); activePunchRef.current = null; return 0; }
                    return prev - 1;
                });
                setIntensity(Math.min(5, 1 + Math.floor(scoreRef.current / 5000)));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [gameState, timeLeft]);

    useEffect(() => {
        if (!videoRef.current || !canvasRef.current || !containerRef.current) return;
        const ctx = canvasRef.current.getContext('2d', { alpha: false });
        if (!ctx) return;

        const pose = new window.Pose({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
        pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

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

            ctx.fillStyle = 'rgba(0, 5, 15, 0.65)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (results.poseLandmarks) {
                const landmarks = results.poseLandmarks;
                const nose = landmarks[0];
                const leftShoulder = landmarks[11];
                const rightShoulder = landmarks[12];
                const mirroredNoseX = 1 - nose.x;
                headPosRef.current = { x: mirroredNoseX, y: nose.y };

                const bnuX = (mirroredNoseX - calibrationRef.current.centerLine) / calibrationRef.current.shoulderWidth;
                const bnuY = (nose.y - calibrationRef.current.baselineY) / calibrationRef.current.shoulderWidth;
                if (now % 5 === 0) setBnuOffset({ x: bnuX, y: bnuY });

                if (gameStateRef.current === 'CALIBRATING') {
                    const currentShoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
                    calibrationRef.current = { shoulderWidth: Math.max(0.01, currentShoulderWidth), centerLine: mirroredNoseX, baselineY: nose.y };
                    ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)'; ctx.lineWidth = 4;
                    ctx.strokeRect((1 - nose.x) * canvas.width - 50, nose.y * canvas.height - 50, 100, 100);
                }
            }

            const p = activePunchRef.current;
            if (p && gameStateRef.current === 'TRAINING') {
                const elapsed = now - p.startTime;
                const progress = elapsed / p.duration;

                if (progress > 1.2) {
                    activePunchRef.current = null;
                    setTimeout(triggerNextPunch, 200 + Math.random() * 300);
                } else {
                    if (progress >= IMPACT_FRAME && p.status === 'flying') {
                        const head = headPosRef.current;
                        const cal = calibrationRef.current;
                        const distX = (head.x - cal.centerLine) / cal.shoulderWidth;
                        const distY = (head.y - cal.baselineY) / cal.shoulderWidth;

                        let rating: DodgeRating = 'NONE';
                        let points = 0;

                        if (p.type === 'hook') {
                            if (distY > DUCK_BNU_Y) { rating = 'CLEAN DUCK'; points = 500; } else { rating = 'HIT'; points = -200; }
                        } else {
                            if (Math.abs(distX) < HIT_BNU_X) { rating = 'HIT'; points = -100; }
                            else if (Math.abs(distX) < SLIP_BNU_X) { rating = 'PERFECT'; points = 300; }
                            else { rating = 'WHIFF'; points = 50; }
                        }

                        p.status = points < 0 ? 'hit' : 'dodged';
                        p.rating = rating;
                        scoreRef.current = Math.max(0, scoreRef.current + points);
                        comboRef.current = points < 0 ? 0 : comboRef.current + 1;
                        setScore(scoreRef.current); setCombo(comboRef.current);
                        setBonusText({ msg: rating, color: points < 0 ? "text-red-500" : "text-cyan-400" });
                        setTimeout(() => setBonusText(null), 800);
                    }

                    const centerX = canvas.width / 2;
                    const centerY = canvas.height / 2;
                    const maxRadius = Math.min(canvas.width, canvas.height) * 0.5;
                    const radius = Math.max(10, progress * maxRadius);
                    let drawX = centerX;
                    if (p.type === 'hook') { drawX += (p.side === 'left' ? -1 : 1) * (1 - progress) * 400; }
                    else { drawX += (p.side === 'left' ? -1 : 1) * (1 - progress) * 100; }

                    ctx.beginPath();
                    ctx.arc(drawX, centerY, radius, 0, Math.PI * 2);
                    ctx.lineWidth = 15 * (1 + progress);

                    if (p.status === 'hit') ctx.strokeStyle = `rgba(255, 0, 0, ${1 - progress})`;
                    else if (p.status === 'dodged') ctx.strokeStyle = `rgba(0, 255, 0, ${1 - progress})`;
                    else ctx.strokeStyle = p.type === 'hook' ? `rgba(255, 165, 0, ${progress})` : `rgba(0, 229, 255, ${progress})`;

                    ctx.shadowBlur = 30 * progress; ctx.shadowColor = ctx.strokeStyle as string;
                    ctx.stroke(); ctx.shadowBlur = 0;
                    ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(drawX, centerY, radius * 0.2, 0, Math.PI * 2); ctx.fill();
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

    return (
        <div className="w-full h-screen bg-[#000510] overflow-hidden font-roboto text-white relative select-none">
            <div ref={containerRef} className="w-full h-full relative bg-black overflow-hidden shadow-[inset_0_0_100px_rgba(0,229,255,0.1)]">
                <video ref={videoRef} className="hidden" playsInline />
                <canvas ref={canvasRef} className="w-full h-full object-cover" />

                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 z-20">
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

                    <div className="flex flex-col items-center justify-center flex-1">
                        {bonusText && (<div className={`text-8xl font-black font-orbitron uppercase tracking-widest italic animate-in zoom-in duration-100 drop-shadow-[0_0_50px_rgba(0,0,0,1)] ${bonusText.color}`}>{bonusText.msg}</div>)}
                    </div>

                    <div className="flex flex-col items-center gap-2 mb-8 bg-black/40 backdrop-blur-md p-6 rounded-full border border-white/5 max-w-fit mx-auto transition-opacity duration-500">
                        <div className="w-[300px] h-1 bg-white/10 rounded-full overflow-hidden flex items-center relative">
                            <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-4 bg-cyan-400/50 z-20" />
                            <div className={`w-4 h-4 rounded-full shadow-[0_0_10px_currentColor] transition-all duration-75 absolute top-1/2 -translate-y-1/2 ${Math.abs(bnuOffset.x) < HIT_BNU_X ? 'bg-green-400 text-green-400' : 'bg-red-500 text-red-500'}`} style={{ left: `${50 + (bnuOffset.x * 30)}%` }} />
                        </div>
                        <div className="text-[9px] font-black uppercase tracking-[0.5em] text-cyan-400/50">Spatial Alignment</div>
                    </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                    {gameState === 'IDLE' && (
                        <div className="pointer-events-auto flex flex-col items-center gap-12 animate-in fade-in zoom-in duration-500">
                            <h1 className="text-8xl font-black font-orbitron text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-600 drop-shadow-[0_0_30px_rgba(0,229,255,0.4)] tracking-tighter italic">CYBER BOX</h1>
                            <button onClick={startCalibration} className="bg-white text-black font-black px-16 py-6 rounded-full text-3xl hover:bg-cyan-400 transition-all font-orbitron shadow-[0_0_50px_rgba(0,229,255,0.3)] hover:scale-110 active:scale-95 tracking-widest">INITIALIZE</button>
                            {leaderboard.length > 0 && (
                                <div className="bg-black/80 backdrop-blur-md p-8 rounded-3xl border border-white/10 w-[400px]">
                                    <div className="text-cyan-400 font-orbitron text-sm tracking-[0.3em] mb-4 text-center">TOP AGENTS</div>
                                    {leaderboard.map((e, i) => (<div key={i} className="flex justify-between py-2 border-b border-white/5 last:border-0"><span className="text-white/70 font-bold">{e.name}</span><span className="text-cyan-400 font-orbitron">{e.score}</span></div>))}
                                </div>
                            )}
                        </div>
                    )}

                    {gameState === 'CALIBRATING' && (
                        <div className="pointer-events-auto flex flex-col items-center gap-8 animate-in zoom-in duration-300">
                            <div className="p-12 bg-black/80 backdrop-blur-xl border border-cyan-500/50 rounded-[3rem] flex flex-col items-center gap-6 shadow-[0_0_100px_rgba(0,229,255,0.2)]">
                                <Ruler className="text-cyan-400 w-16 h-16 animate-pulse" />
                                <div className="text-center"><span className="text-cyan-400 font-black tracking-[0.3em] uppercase text-2xl block mb-2">Calibrating Sensors</span><span className="text-white/50 text-xs font-bold uppercase tracking-[0.5em]">Stand Center & Still</span></div>
                                <button onClick={startTraining} className="bg-cyan-500 text-black font-black px-12 py-4 rounded-full text-xl hover:scale-105 active:scale-95 transition-all font-orbitron mt-4">LOCK IN</button>
                            </div>
                        </div>
                    )}

                    {gameState === 'FINISHED' && (
                        <div className="pointer-events-auto fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-8">
                            <div className="max-w-2xl w-full flex flex-col items-center text-center animate-in slide-in-from-bottom-10 duration-500">
                                <Trophy className="w-24 h-24 text-cyan-400 mb-8 drop-shadow-[0_0_30px_rgba(34,211,238,0.6)]" />
                                <h2 className="text-6xl font-black font-orbitron mb-4 text-white tracking-tighter">SIMULATION OVER</h2>
                                <div className="bg-gradient-to-b from-white/10 to-transparent border border-white/10 p-12 rounded-[3rem] w-full mb-8">
                                    <div className="text-8xl font-black font-orbitron text-cyan-400 mb-8 tracking-tighter drop-shadow-[0_0_20px_rgba(0,229,255,0.5)]">{score.toLocaleString()}</div>
                                    <input type="text" placeholder="ENTER CALLSIGN" autoFocus value={playerName} onChange={(e) => setPlayerName(e.target.value.toUpperCase().slice(0, 10))} className="w-full bg-black/50 border-2 border-white/10 focus:border-cyan-400 rounded-2xl py-6 text-3xl font-black font-orbitron text-center text-white outline-none transition-colors uppercase placeholder:text-white/20" />
                                </div>
                                <div className="flex gap-4 w-full">
                                    <button onClick={saveScore} className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-black py-6 rounded-2xl font-orbitron text-xl transition-all">SAVE DATA</button>
                                    <button onClick={startTraining} className="flex-1 bg-white hover:bg-gray-200 text-black font-black py-6 rounded-2xl font-orbitron text-xl transition-all">RESTART</button>
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