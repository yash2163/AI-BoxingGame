import React from 'react';

interface GameHUDProps {
    score: number;
    currentPoseLabel: string;
    damageFlash: boolean;
    bonusText?: { msg: string, color: string } | null;
    timeLeft: number;
}

export const GameHUD: React.FC<GameHUDProps> = ({ score, currentPoseLabel, damageFlash, bonusText, timeLeft }) => {
    // Format Time 00:00
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const timeString = `${mins}:${secs.toString().padStart(2, '0')}`;
    const isLowTime = timeLeft <= 10;

    return (
        <>
            {/* TOP HUD */}
            <div className="absolute top-0 left-0 p-8 z-30 w-full flex justify-between pointer-events-none items-start">
                {/* SCORE */}
                <div className="bg-black/50 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-widest">Score</div>
                    <div className="text-6xl font-black text-white">{score}</div>
                </div>

                {/* TIMER (Center) */}
                <div className={`bg-black/50 px-8 py-4 rounded-b-2xl border-x border-b border-white/10 backdrop-blur-md transition-colors ${isLowTime ? 'border-red-500 bg-red-900/40' : ''}`}>
                    <div className={`text-5xl font-mono font-black tracking-widest ${isLowTime ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                        {timeString}
                    </div>
                </div>

                {/* POSE LABEL */}
                <div className="text-4xl font-mono text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">
                    {currentPoseLabel}
                </div>
            </div>

            {/* RED FLASH */}
            {damageFlash && (
                <div className="absolute inset-0 z-40 bg-red-600/30 pointer-events-none mix-blend-overlay animate-pulse" />
            )}
        </>
    );
};
