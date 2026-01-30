// src/logic/OvalConfig.ts

export interface OvalConfig {
    inner: { rx: number, ry: number }; // The "Hit" Zone
    outer: { rx: number, ry: number }; // The "Perfect" Zone Boundary
}

export const OVAL_ZONES = {
    // STRAIGHTS: Horizontal Oval (Wide X)
    // Forces significant lateral movement
    STRAIGHT: {
        inner: { rx: 0.50, ry: 0.25 },
        outer: { rx: 0.80, ry: 0.55 }
    },

    // HOOKS: Vertical Oval (Tall Y)
    // Forces Ducking
    HOOK: {
        inner: { rx: 0.20, ry: 0.32 },
        outer: { rx: 0.45, ry: 0.80 }
    }
};
