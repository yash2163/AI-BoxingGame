// src/types.ts

// 1. GAME STATES
export type GameState =
    | 'IDLE'
    | 'CALIBRATING_DIMENSIONS'
    | 'CALIBRATING_POSES'      // Legacy support
    | 'TRAINING_AI'
    | 'PLAYING'
    | 'FINISHED';

// 2. COMBAT TYPES
export type PunchType = 'straight' | 'hook';
export type PunchSide = 'left' | 'right';
export type PunchStatus = 'scheduled' | 'flying' | 'landed' | 'dodged' | 'missed';

export type DodgeRating =
    | 'NONE'
    | 'HIT'
    | 'PERFECT'
    | 'RISKY'
    | 'LUCKY'
    | 'TOO_FAR'
    | 'TOO_LOW'
    | 'NOT_FAR_ENOUGH'
    | 'NOT_DEEP_ENOUGH'
    | 'CAMPING';

export type PoseClass = 'NEUTRAL' | 'LEFT' | 'RIGHT' | 'DUCK';

// 3. ML & MATH TYPES

// New KNN Normalization
export interface NormalizeData {
    noseBase: { x: number, y: number };
    shoulderWidth: number;
    torsoHeight: number;
    hipCenter: { x: number, y: number };
}

// Legacy Calibration for Referee.ts
export interface LegacyCalibrationData extends NormalizeData {
    baselineY: number;
}
export type CalibrationData = LegacyCalibrationData; // For Referee.ts

// 8 Features per frame
export type PoseFeatures = number[];
// Temporal Window
export type TemporalWindow = number[];

// KNN Pose Result
export interface KNNPoseResult {
    window: TemporalWindow | null;
    features: PoseFeatures | null;
}

// Heuristic Pose Result (for Referee.ts)
export interface HeuristicPoseResult {
    label: string;
    leanRatio: number;
    duckRatio: number;
}

// Union
export type PoseResult = KNNPoseResult | HeuristicPoseResult;

// 4. GAME OBJECTS
export interface FightEvent {
    time: number;
    punch: string;
    userMove: string;
    outcome: string;
    scoreDelta: number;
}

export interface PunchProfile {
    animName: string;
    duration: number;
    impactPoint: number;
    damage?: number;
}

export interface ActivePunch {
    id: string;
    side: PunchSide;
    type: PunchType;
    startTime: number;
    impactTime: number;
    duration: number;
    status: PunchStatus;
    rating?: DodgeRating;
}

// 5. UI HELPERS
export interface TrainingStep {
    id: PoseClass;
    label: string;
    instruction: string;
}