import { useState, useRef, useCallback } from 'react';
import type { TrainingStep } from '../types';

interface UseAITrainerProps {
    classifier: any; // KNNClassifier
    featureExtractor: any; // FeatureExtractor
    onTrainingComplete: () => void;
}

const TRAINING_STEPS: TrainingStep[] = [
    { id: 'NEUTRAL', label: 'NEUTRAL GUARD', instruction: 'Hands at cheeks. Stand tall.' },
    { id: 'LEFT', label: 'SLIP LEFT', instruction: 'Lean Left.' },
    { id: 'RIGHT', label: 'SLIP RIGHT', instruction: 'Lean Right.' },
    { id: 'DUCK', label: 'DUCK DOWN', instruction: 'Squat VERTICALLY. Drop your level.' }
];

const SAMPLES_REQUIRED = 50;

export const useAITrainer = ({
    classifier,
    featureExtractor,
    onTrainingComplete
}: UseAITrainerProps) => {
    // State exposed to UI
    const [overlayState, setOverlayState] = useState<{
        title: string, sub: string, count: number | null, color: string, progress: number
    } | null>(null);

    // Internal Refs for State Machine
    const trainingStepIndex = useRef<number>(0);
    const trainingSamples = useRef<number>(0);
    const trainingStateRef = useRef<'PREPARING' | 'RECORDING'>('PREPARING');
    const trainingTimerRef = useRef<number>(0);
    const isTransitioningRef = useRef(false);
    const isActiveRef = useRef(false);

    const startTraining = useCallback(() => {
        classifier.reset();
        trainingStepIndex.current = 0;
        trainingSamples.current = 0;
        trainingStateRef.current = 'PREPARING';
        trainingTimerRef.current = performance.now() + 3000;
        isTransitioningRef.current = false;
        isActiveRef.current = true;

        // Instant visual feedback
        const first = TRAINING_STEPS[0];
        setOverlayState({
            title: `GET READY: ${first.label}`,
            sub: first.instruction,
            count: 3,
            color: 'text-orange-500',
            progress: 0
        });
    }, [classifier]);

    // Main tick function to be called from the frame loop
    const processFrame = (landmarks: any, now: number) => {
        if (!isActiveRef.current) return;

        // If we are transitioning out, don't process
        if (isTransitioningRef.current) return;

        const step = TRAINING_STEPS[trainingStepIndex.current];
        if (!step) {
            // Sequence Complete
            if (!isTransitioningRef.current) {
                isTransitioningRef.current = true;
                setOverlayState({ title: "SYNC COMPLETE", sub: "FIGHT!", count: null, color: 'text-green-600', progress: 100 });

                setTimeout(() => {
                    setOverlayState(null);
                    isActiveRef.current = false;
                    onTrainingComplete();
                }, 2000);
            }
            return;
        }

        const result = featureExtractor.processFrame(landmarks);

        if (trainingStateRef.current === 'PREPARING') {
            const timeLeft = Math.ceil((trainingTimerRef.current - now) / 1000);
            // Fill buffer if needed (result.window usually fills internally in FeatureExtractor)

            if (timeLeft > 0) {
                // Update countdown UI
                // Optimization: Only update if count changes to avoid React render thrashing? 
                // However, the original updated every frame effectively via setOverlayState (though React batches).
                // Let's rely on React's diffing or just update.
                // To avoid spamming, we can check if the displayed count matches.
                setOverlayState(prev => {
                    if (prev?.count === timeLeft) return prev;
                    return { title: `GET READY: ${step.label}`, sub: step.instruction, count: timeLeft, color: 'text-orange-500', progress: 0 };
                });
            } else {
                trainingStateRef.current = 'RECORDING';
                setOverlayState({ title: "HOLD STILL!", sub: "Scanning...", count: null, color: 'text-red-600', progress: 0 });
            }
        }
        else if (trainingStateRef.current === 'RECORDING') {
            if (result && result.window) {
                if (trainingSamples.current < SAMPLES_REQUIRED) {
                    classifier.addExample(step.id, result.window);
                    trainingSamples.current++;
                    const progress = (trainingSamples.current / SAMPLES_REQUIRED) * 100;
                    setOverlayState(prev => prev ? { ...prev, progress } : null); // This might spam state updates every frame.
                    // Ideally we throttle this or only update on integer changes? 
                    // 50 samples is fast, so every frame update is okay for smooth bar.
                } else {
                    // Step Done
                    trainingStepIndex.current++;
                    trainingSamples.current = 0;
                    trainingStateRef.current = 'PREPARING';
                    trainingTimerRef.current = now + 2000;
                }
            }
        }
    };

    return {
        startTraining,
        processFrame,
        overlayState,
        currentStepId: TRAINING_STEPS[trainingStepIndex.current]?.id, // Expose current Step ID (NEUTRAL, LEFT, etc)
        isActive: isActiveRef.current
    };
};
