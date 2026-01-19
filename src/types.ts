export type GameState = 'IDLE' | 'CALIBRATING' | 'PLAYING' | 'FINISHED';
export type PunchType = 'straight' | 'hook';
export type PunchSide = 'left' | 'right';

// Updated Statuses for the new logic
export type PunchStatus = 'scheduled' | 'flying' | 'landed' | 'missed';

// New precise ratings
export type DodgeRating = 'NONE' | 'HIT' | 'PERFECT' | 'TOO_FAR' | 'EARLY' | 'LATE';

export type PoseClass = 'NEUTRAL' | 'LEFT' | 'RIGHT' | 'DUCK';

// --- NEW DATA STRUCTURES ---

// 1. The "DNA" of a punch (Static data from GLB)
export interface PunchProfile {
    animName: string;      // e.g., "LeftHook"
    duration: number;      // Actual clip duration in seconds (e.g., 2.1s)
    impactPoint: number;   // Exact % where arm is fully extended (e.g., 0.45)
    damage: number;        // Base damage value
}

// 2. The Active Instance (Dynamic data during game)
export interface ActivePunch {
    id: string;
    side: PunchSide;
    type: PunchType;
    startTime: number;     // Performance.now() timestamp
    impactTime: number;    // Exact calculated timestamp of impact
    duration: number;      // Total duration (ms) adjusted for speed
    status: PunchStatus;
    rating?: DodgeRating;
}

// 3. User State
export interface CalibrationData {
    baselineY: number;     // Nose Y when standing neutral
    shoulderWidth: number; // Distance between shoulders (Unit of measurement)
}

export interface PoseResult {
    label: string;         // "LEFT", "RIGHT", "DUCK" (For Debug UI)
    leanRatio: number;     // -1.0 to 1.0 (Horizontal movement)
    duckRatio: number;     // 0.0 to 1.0 (Vertical movement)
}

// 4. Logs
export interface FightEvent {
    time: number;
    punch: string;
    userMove: string;
    outcome: string;
    scoreDelta: number;
}