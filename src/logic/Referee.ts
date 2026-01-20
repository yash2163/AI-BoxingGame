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

/**
 * THE JUDGE: Determines hit/miss based on Elliptical Zones
 */
export const judgeImpact = (
    punchType: PunchType,
    punchSide: PunchSide,
    pose: HeuristicPoseResult
): DodgeRating => {

    // --- LOGIC 1: STRAIGHTS (Horizontal Oval) ---
    if (punchType === 'straight') {
        const x = pose.leanRatio;

        // Target Direction:
        // Left Punch -> User must slip RIGHT (Negative X on screen)
        // Right Punch -> User must slip LEFT (Positive X on screen)
        // (Assuming Mirrored Display)
        const isCorrectDirection = (punchSide === 'left' && x < 0) || (punchSide === 'right' && x > 0);

        const absX = Math.abs(x);

        // Zone 1: Hit (Still in center)
        if (absX < 0.20) return 'HIT';

        // Zone 2: Perfect Slip
        if (absX >= 0.20 && absX <= 0.50) {
            return isCorrectDirection ? 'PERFECT' : 'HIT'; // Wrong way = Hit
        }

        // Zone 3: Too Far (Off balance)
        if (absX > 0.50) return 'TOO_FAR';
    }

    // --- LOGIC 2: HOOKS (Vertical Oval) ---
    if (punchType === 'hook') {
        const y = pose.duckRatio; // Positive is Down

        // Zone 1: Hit (Standing tall)
        if (y < 0.20) return 'HIT';

        // Zone 2: Clean Duck
        if (y >= 0.20 && y <= 0.60) return 'PERFECT';

        // Zone 3: Too Low (Squatting)
        if (y > 0.60) return 'TOO_FAR';
    }

    return 'HIT'; // Default Fallback
};