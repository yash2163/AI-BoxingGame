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