import React from 'react';
import { OVAL_ZONES } from '../../logic/OvalConfig';
import type { PunchType } from '../../types';

interface Props {
    punchType: PunchType | null;
    headPos: { x: number, y: number };
}

export const HitZoneVisualizer: React.FC<Props> = ({ punchType, headPos }) => {
    // Default to 'STRAIGHT' config if idle, just to show something (or hide it)
    // User requested "Always On", so let's show Straight configuration by default or switch based on last punch?
    // Let's show "STRAIGHT" ovals by default for neutral training.

    // We need to map our Normalized Coordinates (-1.0 to 1.0) to CSS percentages (0% to 100%)
    // Center (0,0) -> 50%, 50%
    // +1.0 X -> 100%
    // -1.0 X -> 0%

    const config = punchType === 'hook' ? OVAL_ZONES.HOOK : OVAL_ZONES.STRAIGHT;

    // Helper to Convert Radius to CSS % width/height
    // Normalized 1.0 = 50% of screen width (from center)
    // So Diameter = Radius * 2 * 50% = Radius * 100% ? 
    // Wait. 
    // X range is -1 to 1. Total width 2.
    // If RadiusX is 0.5. Diameter is 1.0. 
    // In CSS % of container (assuming container is the "Normalizer Box"):
    // Width = (Rx * 2) / 2 * 100% = Rx * 100%.

    const getStyle = (rx: number, ry: number, color: string) => ({
        width: `${rx * 100}%`,
        height: `${ry * 100}%`,
        borderColor: color,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)'
    });

    const headX = (headPos.x * 50) + 50; // -1 -> 0, 0 -> 50, 1 -> 100
    const headY = (headPos.y * 50) + 50; // -1 -> 0, 0 -> 50, 1 ? 100

    return (
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden flex items-center justify-center opacity-80">
            {/* CONTAINER: Represents the Normalized Space (-1 to 1 X, -? to ? Y) */}
            {/* Aspect Ratio might warp ellipses if not careful. 
                Our Logic matches X/Y ratios independent of screen aspect.
                Ideally this container should match the "Shoulder Width Unit" box.
                But for UI simplicity, let's assume it fills the screen for now 
                and stretch to fit, as the user moves within the frame.
            */}

            <div className="relative w-full h-full max-w-3xl max-h-3xl">
                {/* Note: We constrain max size to keep it near the player in center */}

                {/* INNER OVAL (HIT ZONE) */}
                <div
                    className="absolute border-4 rounded-[50%] transition-all duration-300"
                    style={{
                        ...getStyle(config.inner.rx, config.inner.ry, 'rgba(255, 0, 0, 0.5)'),
                        background: 'rgba(255, 0, 0, 0.1)'
                    }}
                >
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 text-red-500 font-bold text-xs">HIT</div>
                </div>

                {/* OUTER OVAL (PERFECT BOUNDARY) */}
                <div
                    className="absolute border-4 border-dashed rounded-[50%] transition-all duration-300"
                    style={getStyle(config.outer.rx, config.outer.ry, 'rgba(0, 255, 0, 0.4)')}
                >
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-green-500 font-bold text-xs">PERFECT</div>
                </div>

                {/* HEAD CURSOR */}
                <div
                    className="absolute w-6 h-6 bg-yellow-400 rounded-full border-2 border-white shadow-[0_0_10px_yellow] transition-all duration-75 ease-linear"
                    style={{
                        left: `${headX}%`,
                        top: `${headY}%`,
                        transform: 'translate(-50%, -50%)'
                    }}
                />
            </div>

            <div className="absolute bottom-10 right-10 text-white/50 text-xs font-mono">
                PUNCH: {punchType?.toUpperCase() || 'NONE'} <br />
                HEAD: {headPos.x.toFixed(2)}, {headPos.y.toFixed(2)}
            </div>
        </div>
    );
};
