import type { ActivePunch, DodgeRating, PoseClass, PoseFeatures } from '../types';

// CONFIG
const MIN_VELOCITY_THRESHOLD = 0.05; // Minimum movement speed to count as a dodge

/**
 * THE COMBAT ENGINE
 * Determines the outcome based on:
 * 1. The Punch (Type/Side)
 * 2. The User's Pose (Classified by ML/KNN)
 * 3. The User's Velocity (Did they actually move?)
 */
export const resolveCombat = (
    punch: ActivePunch,
    pose: PoseClass,
    features: PoseFeatures
): DodgeRating => {

    // 1. VELOCITY GATE (Anti-Cheese)
    // Feature 6 is head_dx_velocity, Feature 7 is head_dy_velocity
    const velX = Math.abs(features[6]);
    const velY = Math.abs(features[7]);

    // If user is effectively stationary, they are "Camping".
    if (pose !== 'NEUTRAL' && velX < MIN_VELOCITY_THRESHOLD && velY < MIN_VELOCITY_THRESHOLD) {
        return 'CAMPING';
    }

    // 2. NEUTRAL CHECK
    if (pose === 'NEUTRAL') return 'NONE';

    // 3. RULE TABLE
    const pType = punch.type;
    const pSide = punch.side;

    // --- STRAIGHTS ---
    if (pType === 'straight') {
        // Correct Move: Slip Opposite
        if (pSide === 'left') {
            if (pose === 'RIGHT') return 'PERFECT';
            if (pose === 'LEFT') return 'RISKY'; // Slip into punch
            if (pose === 'DUCK') return 'LUCKY'; // Ducking straight is okay but risky
        }

        if (pSide === 'right') {
            if (pose === 'LEFT') return 'PERFECT';
            if (pose === 'RIGHT') return 'RISKY';
            if (pose === 'DUCK') return 'LUCKY';
        }
    }

    // --- HOOKS ---
    if (pType === 'hook') {
        // Correct Move: DUCK only
        if (pose === 'DUCK') return 'PERFECT';

        // Slipping a hook is dangerous
        if (pose === 'LEFT' || pose === 'RIGHT') return 'LUCKY';
    }

    return 'NONE';
};