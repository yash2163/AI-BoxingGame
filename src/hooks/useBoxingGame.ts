import { useState, useRef, useEffect, useCallback } from 'react';
import { useBoxingAssets } from './useBoxingAssets';
import { resolveCombat } from '../logic/CombatRules';
import type {
    PunchSide, PunchType, ActivePunch, FightEvent,
    DodgeRating, GameState, PoseClass, PoseFeatures
} from '../types';

const ROUND_TIME = 60;

interface UseBoxingGameProps {
    onGameOver: (score: number) => void;
}

export const useBoxingGame = ({ onGameOver }: UseBoxingGameProps) => {
    // State
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0); // Currently unused in HUD but tracked
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const [speedMultiplier, setSpeedMultiplier] = useState(1.0);

    // UI Effects
    const [damageFlash, setDamageFlash] = useState(false);
    const [bonusText, setBonusText] = useState<{ msg: string, color: string } | null>(null);

    // Refs
    const gameStateRef = useRef<GameState>('IDLE');
    const { punchProfiles } = useBoxingAssets();

    // Game Logic Refs
    const activePunchRef = useRef<ActivePunch | null>(null);
    const fightLogRef = useRef<FightEvent[]>([]);
    const timerRef = useRef<number | null>(null);
    const gameTimerIntervalRef = useRef<number | null>(null);
    const timeLeftRef = useRef(ROUND_TIME); // For sync access without state lag

    // Speed Ref (for async access in timeouts)
    const speedRef = useRef(1.0);
    useEffect(() => { speedRef.current = speedMultiplier; }, [speedMultiplier]);

    // --- METHODS ---

    const handleOutcome = (rating: DodgeRating, punch: ActivePunch, poseLabel: string) => {
        let points = 0;
        let color = 'text-gray-500';

        if (rating === 'HIT') {
            points = -100;
            setDamageFlash(true);
            setTimeout(() => setDamageFlash(false), 200);
            color = 'text-red-600';
        } else if (rating === 'PERFECT') {
            points = 300;
            color = 'text-green-400';
        } else if (rating === 'RISKY') {
            points = 50;
            color = 'text-orange-400';
        } else if (rating === 'LUCKY') {
            points = 100;
            color = 'text-yellow-400';
        }

        if (points !== 0) {
            setScore(s => Math.max(0, s + points));
            setBonusText({ msg: rating, color });
            setTimeout(() => setBonusText(null), 1000);
            if (points > 0) setCombo(c => c + 1); else setCombo(0);

            fightLogRef.current.push({
                time: ROUND_TIME - timeLeftRef.current,
                punch: `${punch.side}_${punch.type}`,
                userMove: poseLabel,
                outcome: rating,
                scoreDelta: points
            });
        }
    };

    const scheduleNextPunch = useCallback(() => {
        if (!punchProfiles || Object.keys(punchProfiles).length === 0) return;
        if (gameStateRef.current !== 'PLAYING' || timeLeftRef.current <= 0) return;

        if (timerRef.current) clearTimeout(timerRef.current);

        const delay = (1000 + Math.random() * 1500) / speedRef.current;

        timerRef.current = window.setTimeout(() => {
            if (gameStateRef.current !== 'PLAYING') return;

            const options = ['LeftStraight', 'RightStraight', 'LeftHook', 'RightHook'];
            const animName = options[Math.floor(Math.random() * options.length)];
            const profile = punchProfiles[animName];

            if (!profile) { scheduleNextPunch(); return; }

            const now = performance.now();
            const duration = (profile.duration * 1000) / speedRef.current;
            const impactTime = duration * profile.impactPoint;

            const side = animName.toLowerCase().includes('left') ? 'left' : 'right';
            const type = animName.toLowerCase().includes('hook') ? 'hook' : 'straight';

            activePunchRef.current = {
                id: `punch-${now}`,
                side: side as PunchSide,
                type: type as PunchType,
                startTime: now,
                impactTime: now + impactTime,
                duration: duration,
                status: 'flying'
            };

            // Recursive call for next punch
            timerRef.current = window.setTimeout(scheduleNextPunch, duration + 200);

        }, delay);
    }, [punchProfiles]); // Removed speedRef from deps as it's a ref

    const startGame = useCallback(() => {
        setScore(0);
        setCombo(0);
        setTimeLeft(ROUND_TIME);
        timeLeftRef.current = ROUND_TIME;
        fightLogRef.current = [];
        activePunchRef.current = null;
        gameStateRef.current = 'PLAYING';

        // Start Clock
        if (gameTimerIntervalRef.current) clearInterval(gameTimerIntervalRef.current);
        gameTimerIntervalRef.current = window.setInterval(() => {
            setTimeLeft(prev => {
                const newVal = prev - 1;
                timeLeftRef.current = newVal;
                if (newVal <= 0) {
                    stopGame();
                    return 0;
                }
                return newVal;
            });
        }, 1000);

        // Start Punches
        scheduleNextPunch();
    }, [scheduleNextPunch]);

    const stopGame = useCallback(() => {
        gameStateRef.current = 'FINISHED';
        if (gameTimerIntervalRef.current) clearInterval(gameTimerIntervalRef.current);
        if (timerRef.current) clearTimeout(timerRef.current);
        onGameOver(score); // Pass score to parent
    }, [score, onGameOver]);

    // Main Tick (Feature Processing)
    const processGameFrame = (poseLabel: string, features: PoseFeatures, now: number) => {
        if (gameStateRef.current !== 'PLAYING') return;

        const p = activePunchRef.current;
        if (p && p.status === 'flying') {
            const progress = (now - p.startTime) / p.duration;

            // Dodge Window
            if (progress > 0.35 && progress < 0.75) {
                const outcome = resolveCombat(p, poseLabel as PoseClass, features);
                if (outcome !== 'NONE' && outcome !== 'CAMPING') {
                    p.status = 'dodged';
                    p.rating = outcome;
                    handleOutcome(outcome, p, poseLabel);
                }
            }
            // Hit Window
            else if (progress >= 0.80) {
                p.status = 'landed';
                p.rating = 'HIT';
                handleOutcome('HIT', p, poseLabel);
            }
        }
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (gameTimerIntervalRef.current) clearInterval(gameTimerIntervalRef.current);
            if (timerRef.current) clearTimeout(timerRef.current);
        }
    }, [])

    return {
        score,
        timeLeft,
        activePunchRef,
        fightLogRef,
        damageFlash,
        bonusText,
        combo,
        startGame,
        stopGame, // manually stop if needed
        processGameFrame,
        speedMultiplier,
        setSpeedMultiplier,
        gameStateRef // exposed if needed to check state synchronously
    };
};
