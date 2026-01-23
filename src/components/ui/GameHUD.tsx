import React from 'react';

interface GameHUDProps {
    score: number;
    currentPoseLabel: string;
    flashColor: string | null;
    bonusText?: { msg: string, color: string } | null;
    timeLeft: number;
}

export const GameHUD: React.FC<GameHUDProps> = ({ score, currentPoseLabel, flashColor, bonusText, timeLeft }) => {
    // Format Time 00:00
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const timeString = `${mins}:${secs.toString().padStart(2, '0')}`;
    const isLowTime = timeLeft <= 10;

    // Determine Flash Color Class
    let flashClass = '';
    if (flashColor === 'red') flashClass = 'bg-red-600/30';
    if (flashColor === 'orange') flashClass = 'bg-orange-500/30';

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

            {/* BONUS TEXT */}
            {bonusText && (
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none animate-in fade-in zoom-in slide-in-from-bottom-5 duration-300">
                    <div className={`text-6xl font-black italic ${bonusText.color} drop-shadow-lg`}>
                        {bonusText.msg}
                    </div>
                </div>
            )}


            {/* FLASH OVERLAY */}
            {flashColor && (
                <div className={`absolute inset-0 z-40 pointer-events-none mix-blend-overlay animate-pulse ${flashClass}`} />
            )}
        </>
    );
};
