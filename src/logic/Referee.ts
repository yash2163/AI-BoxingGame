import type { CalibrationData, HeuristicPoseResult, PunchSide, PunchType, DodgeRating } from '../types';

/**
 * Normalizes raw MediaPipe landmarks into a standard coordinate system relative to the user's body.
 * Unit 1.0 = Shoulder Width.
 */
export const analyzeUserPose = (landmarks: any[], calibration: CalibrationData): HeuristicPoseResult => {
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    // 1. Dynamic Normalization (Handle user moving forward/back)
    const currentWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    // Smooth the scale factor to prevent jitter if detection flickers
    const scaleFactor = (currentWidth + calibration.shoulderWidth) / 2;

    // 2. Center Point (Midpoint of shoulders)
    const midPointX = (leftShoulder.x + rightShoulder.x) / 2;

    // 3. Calculate Lean (Horizontal X)
    // Note: MediaPipe coords are usually 0 (Left) to 1 (Right) relative to IMAGE.
    // If user leans to THEIR Left, on screen (mirror) they move to Right side of image (+X).
    const leanRaw = nose.x - midPointX;
    const leanRatio = leanRaw / scaleFactor;

    // 4. Calculate Duck (Vertical Y)
    // +Y is Down in MediaPipe.
    const duckRaw = nose.y - calibration.baselineY;
    const duckRatio = duckRaw / scaleFactor;

    // Generate Label for UI
    let label = "NEUTRAL";
    if (duckRatio > 0.25) label = "DUCK";
    else if (leanRatio > 0.25) label = "LEFT"; // Screen Right
    else if (leanRatio < -0.25) label = "RIGHT"; // Screen Left

    return { label, leanRatio, duckRatio };
};

import { OVAL_ZONES } from './OvalConfig';

/**
 * THE JUDGE: Determines hit/miss based on Elliptical Zones
 */
export const judgeImpact = (
    punchType: PunchType,
    punchSide: PunchSide,
    pose: HeuristicPoseResult
): DodgeRating => {
    const { leanRatio: x, duckRatio: y } = pose;

    // 1. Select Config
    const config = punchType === 'straight' ? OVAL_ZONES.STRAIGHT : OVAL_ZONES.HOOK;

    // 2. Calculate Ellipse Distance (Normalized)
    // Formula: (x/rx)^2 + (y/ry)^2
    // d < 1 : Inside Inner (Hit)
    // d < 1 (for outer) : Inside Outer

    // We check against Inner first
    const innerDist = Math.pow(x / config.inner.rx, 2) + Math.pow(y / config.inner.ry, 2);

    // HIT CHECK (Inside Inner)
    if (innerDist < 1.0) {
        if (punchType === 'straight') return 'NOT_FAR_ENOUGH';
        if (punchType === 'hook') return 'NOT_DEEP_ENOUGH';
        return 'HIT';
    }

    // PERFECT CHECK (Must be inside Outer but outside Inner)
    const outerDist = Math.pow(x / config.outer.rx, 2) + Math.pow(y / config.outer.ry, 2);

    if (outerDist < 1.0) {
        // We are safe! But did we move in the WRONG direction?
        // Straights: Must slip opposite
        if (punchType === 'straight') {
            const isCorrectDirection = (punchSide === 'left' && x < 0) || (punchSide === 'right' && x > 0);
            if (!isCorrectDirection) return 'RISKY'; // Safe, but wrong way
        }

        // Hooks: Must DUCK, not SLIP
        if (punchType === 'hook') {
            // Inner rx is 0.20, so if we are outside that, we likely slipped.
            // If we have significant lateral movement, penalize it.
            if (Math.abs(x) > 0.2) return 'LUCKY';
        }

        return 'PERFECT';
    }

    // TOO FAR CHECK
    if (punchType === 'hook') return 'TOO_LOW';
    return 'TOO_FAR';
};