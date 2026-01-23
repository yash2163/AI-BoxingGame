import React, { useRef, useState } from 'react';

// Logic & Types
import { FeatureExtractor } from './logic/FeatureExtractor';
import { KNNClassifier } from './logic/PoseModel';
import { RealTimeCoachService } from './logic/RealTimeCoach';
import type { GameState, ActivePunch, DodgeRating, PoseClass } from './types';

// Hooks
import { usePoseTracking } from './hooks/usePoseTracking';
import { useAITrainer } from './hooks/useAITrainer';
import { useBoxingGame } from './hooks/useBoxingGame';

// Components
import { Scene3D } from './components/Scene3D';
import { CalibrationUI } from './components/ui/CalibrationUI';
import { TrainingUI } from './components/ui/TrainingUI';

import { GameHUD } from './components/ui/GameHUD';
import { MainMenu } from './components/ui/MainMenu';
import { GameOverScreen } from './components/ui/GameOverScreen';
import { HitZoneVisualizer } from './components/ui/HitZoneVisualizer';
import { UserManual } from './components/ui/UserManual';

// Utils
import { drawSkeleton } from './logic/drawingUtils';
import { getCoachingAdvice } from './logic/AiCoachService';
import { combatAI } from './logic/CombatAI';

const GeminiBoxingCoach: React.FC = () => {
    // 1. HARDWARE & LOGIC REFS
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const featureExtractorRef = useRef(new FeatureExtractor());
    const classifierRef = useRef(new KNNClassifier());
    const realTimeCoachRef = useRef(new RealTimeCoachService());

    // 2. STATE
    const [gameState, setGameState] = useState<GameState>('IDLE');
    const [currentPoseLabel, setCurrentPoseLabel] = useState<string>("NEUTRAL");
    const [headPos, setHeadPos] = useState({ x: 0, y: 0 }); // Visualizer State
    const [aiFeedback, setAiFeedback] = useState<string>("");

    // 3. HOOKS
    // Game Logic
    const game = useBoxingGame({
        onGameOver: (_) => {
            setGameState('FINISHED');
            // Assuming we might want to fetch feedback here or wait for user action
        },
        onCombatResult: (punch: ActivePunch, rating: DodgeRating, poseLabel: string) => {
            // Trigger Real-Time Coach
            if (canvasRef.current) {
                // Capture low-res snapshot for speed
                const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.5);
                realTimeCoachRef.current.analyzeInteraction(dataUrl, {
                    punchType: punch.type,
                    punchSide: punch.side,
                    outcome: rating,
                    userMove: poseLabel as PoseClass
                });
            }
        }
    });

    // AI Trainer
    const trainer = useAITrainer({
        classifier: classifierRef.current,
        featureExtractor: featureExtractorRef.current,
        onTrainingComplete: () => {
            setGameState('PLAYING');
            game.startGame();
        }
    });

    // Vision
    const { isCameraReady, error } = usePoseTracking({
        videoRef,
        onResults: (results) => handleVisionResults(results)
    });

    // 4. VISION LOOP
    const handleVisionResults = (results: any) => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize Canvas if needed
        if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        }

        // Draw Frame
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        // Draw Skeleton Overlay
        if (results.poseLandmarks) {
            drawSkeleton(ctx, results.poseLandmarks);
        }

        ctx.restore();

        if (!results.poseLandmarks) return;

        const now = performance.now();
        const landmarks = results.poseLandmarks;
        const nose = landmarks[0];

        // --- STATE MACHINE HANDLERS ---

        // A. CALIBRATION (Baseline)
        if (gameState === 'CALIBRATING_DIMENSIONS') {
            const left = landmarks[11];
            const right = landmarks[12];
            const lHip = landmarks[23];
            const rHip = landmarks[24];

            if (left && right && lHip && rHip) {
                const width = Math.abs(left.x - right.x);
                const hipY = (lHip.y + rHip.y) / 2;
                const torso = Math.abs(nose.y - hipY);

                featureExtractorRef.current.setBaseline({
                    noseBase: { x: nose.x, y: nose.y },
                    shoulderWidth: width,
                    torsoHeight: torso,
                    hipCenter: { x: (lHip.x + rHip.x) / 2, y: hipY }
                });

                // Visual Feedback (Blue Box)
                ctx.strokeStyle = '#0066cc';
                ctx.lineWidth = 4;
                ctx.strokeRect((1 - nose.x) * canvas.width - 50, nose.y * canvas.height - 50, 100, 100);
            }
        }

        // B. TRAINING (Data Collection)
        else if (gameState === 'TRAINING_AI') {
            trainer.processFrame(landmarks, now);
        }

        // C. PLAYING (Game Loop)
        else if (gameState === 'PLAYING') {
            const result = featureExtractorRef.current.processFrame(landmarks);
            if (result && result.window && result.features) {
                const poseLabel = classifierRef.current.predict(result.window);
                setCurrentPoseLabel(poseLabel);
                // Update Head Pos for UI (Feature 0=dx, 1=dy)
                setHeadPos({ x: result.features[0], y: result.features[1] });
                game.processGameFrame(poseLabel, result.features, now);
            }
        }
    };

    // 5. HANDLERS
    const handleStartCalibration = (name: string) => {
        combatAI.loadProfile(name); // Load RL Profile
        setGameState('CALIBRATING_DIMENSIONS');
    };

    const handleLockPosition = () => {
        setGameState('TRAINING_AI');
        trainer.startTraining();
    };

    const handleRestart = () => {
        setGameState('IDLE');
        setAiFeedback("");
        // Reset hooks if needed
    };

    const generateCoachingAdvice = async () => {
        setAiFeedback("Analyzing combat data...");
        try {
            const history = game.fightLogRef.current;
            if (history.length === 0) {
                setAiFeedback("No fight data available to analyze. Throw some punches next time!");
                return;
            }

            // Call Real AI Service
            // Note: Make sure VITE_GEMINI_API_KEY is allowed in your dashboard
            const feedback = await getCoachingAdvice(history);
            setAiFeedback(feedback);

        } catch (e) {
            console.error(e);
            setAiFeedback("Error connecting to Neural Link.");
        }
    };

    return (
        <div className="w-full h-screen bg-gray-900 text-white overflow-hidden relative">

            {/* 3D SCENE */}
            <Scene3D
                activePunchRef={game.activePunchRef}
                speedMultiplier={game.speedMultiplier}
                showOpponent={gameState === 'PLAYING'}
                showRing={gameState === 'PLAYING'}
                headPos={headPos}
            />

            {/* VIDEO BG */}
            <div ref={containerRef} className="absolute inset-0 z-0 w-full h-full">
                <video ref={videoRef} className="hidden" playsInline muted />
                <canvas ref={canvasRef} className="w-full h-full object-cover opacity-60" />
            </div>

            {/* UI LAYERS */}
            {gameState === 'PLAYING' && (
                <HitZoneVisualizer
                    punchType={game.activePunchRef.current?.type || null}
                    headPos={headPos}
                />
            )}

            {gameState === 'IDLE' && (
                <MainMenu
                    cameraReady={isCameraReady}
                    onStart={handleStartCalibration}
                    speed={game.speedMultiplier}
                    onSpeedChange={game.setSpeedMultiplier}
                    onOpenManual={() => setGameState('MANUAL')}
                />
            )}

            {gameState === 'MANUAL' && (
                <UserManual onBack={() => setGameState('IDLE')} />
            )}

            {gameState === 'CALIBRATING_DIMENSIONS' && (
                <CalibrationUI onLockPosition={handleLockPosition} />
            )}

            {gameState === 'TRAINING_AI' && (
                <>
                    <HitZoneVisualizer
                        // Map Training Step to Visual Config
                        punchType={
                            trainer.currentStepId === 'LEFT' || trainer.currentStepId === 'RIGHT' ? 'straight' :
                                trainer.currentStepId === 'DUCK' ? 'hook' :
                                    null
                        }
                        headPos={headPos}
                    />
                    <TrainingUI gameState={gameState} overlayState={trainer.overlayState} />
                </>
            )}



            {gameState === 'PLAYING' && (
                <GameHUD
                    score={game.score}
                    currentPoseLabel={currentPoseLabel}
                    flashColor={game.flashColor}
                    bonusText={game.bonusText}
                    timeLeft={game.timeLeft}
                />
            )}

            {gameState === 'FINISHED' && (
                <GameOverScreen
                    score={game.score}
                    onRestart={handleRestart}
                    onGetFeedback={generateCoachingAdvice}
                    aiFeedback={aiFeedback}
                />
            )}

            {/* ERROR TOAST */}
            {error && (
                <div className="absolute top-4 right-4 bg-red-600 text-white p-4 rounded shadow-lg z-[100]">
                    Camera Error: {error}
                </div>
            )}
        </div>
    );
};

export default GeminiBoxingCoach;