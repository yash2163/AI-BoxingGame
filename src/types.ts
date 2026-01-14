// src/types.ts

export type GameState = 'IDLE' | 'CALIBRATING_DIMENSIONS' | 'TRAINING_AI' | 'PLAYING' | 'FINISHED';
export type PunchType = 'straight' | 'hook';
export type PunchSide = 'left' | 'right';
export type PunchStatus = 'flying' | 'hit' | 'dodged';
export type DodgeRating = 'NONE' | 'HIT' | 'WHIFF' | 'PERFECT' | 'CLEAN DUCK' | 'OUTSIDE!' | 'BLOCKED' | 'TOO SHALLOW' | 'LUCKY DUCK';
export type PoseClass = 'NEUTRAL' | 'LEFT' | 'RIGHT' | 'DUCK';

export interface FightEvent {
    time: number;
    punch: string;
    userMove: string;
    outcome: string;
    scoreDelta: number;
}

export interface CalibrationData {
    shoulderWidth: number;
    centerLine: number;
    baselineY: number;
}

// THIS IS THE INTERFACE THAT WAS MISSING
export interface Punch {
    id: string;
    side: PunchSide;
    type: PunchType;
    startTime: number;
    duration: number;
    status: PunchStatus;
    rating?: DodgeRating;
}

export interface Point {
    x: number;
    y: number;
}