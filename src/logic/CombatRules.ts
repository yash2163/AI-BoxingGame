import { judgeImpact } from './Referee';
import type { ActivePunch, DodgeRating, PoseClass, PoseFeatures, HeuristicPoseResult } from '../types';

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

    // 2. CONSTRUCT POSE RESULT FOR REFEREE
    // Feature 0: Head Horizontal Normalized (Lean)
    // Feature 1: Head Vertical Normalized (Duck)
    const poseResult: HeuristicPoseResult = {
        label: pose,
        leanRatio: features[0],
        duckRatio: features[1]
    };

    // 3. DELEGATE TO OVAL JUDGE
    return judgeImpact(punch.type, punch.side, poseResult);
};