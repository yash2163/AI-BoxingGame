import React from 'react';

interface GameHUDProps {
    score: number;
    currentPoseLabel: string;
    damageFlash: boolean;
    bonusText?: { msg: string, color: string } | null;
}

export const GameHUD: React.FC<GameHUDProps> = ({ score, currentPoseLabel, damageFlash, bonusText }) => {
    return (
        <>
            {/* TOP HUD */}
            <div className="absolute top-0 left-0 p-8 z-30 w-full flex justify-between pointer-events-none">
                <div className="bg-black/50 p-6 rounded-2xl border border-white/10">
                    <div className="text-gray-400 text-xs font-bold uppercase">Score</div>
                    <div className="text-6xl font-black">{score}</div>
                </div>

                {/* Center Bonus/Combo Text (Optional improvement from legacy code) */}
                {bonusText && (
                    <div className={`absolute top-20 left-1/2 -translate-x-1/2 text-4xl font-black ${bonusText.color} animate-bounce`}>
                        {bonusText.msg}
                    </div>
                )}

                <div className="text-4xl font-mono text-cyan-400">{currentPoseLabel}</div>
            </div>

            {/* RED FLASH */}
            {damageFlash && (
                <div className="absolute inset-0 z-40 bg-red-600/30 pointer-events-none mix-blend-overlay animate-pulse" />
            )}
        </>
    );
};
