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


    return (
        <>
            {/* SCANLINE OVERLAY */}
            <div className="absolute inset-0 z-10 pointer-events-none opacity-10 bg-[url('https://media.istockphoto.com/id/1346575545/vector/scan-lines-pattern-overlay-vector-texture.jpg?s=612x612&w=0&k=20&c=Lw-bdfu0J8v2tP1lA5vJ8xZk5j0j3q4q8pQ8qQ8qQ8q=')] bg-cover mix-blend-overlay" />

            {/* TOP HUD: Minimalist Bar */}
            <div className="absolute top-0 left-0 w-full p-6 z-30 flex justify-between items-start pointer-events-none">
                {/* LEFT: Score */}
                <div className="flex flex-col">
                    <div className="text-cyan-500 text-[10px] font-bold tracking-[0.2em] uppercase">Score</div>
                    <div className="text-4xl font-mono text-white tracking-widest leading-none">{score.toString().padStart(6, '0')}</div>
                </div>

                {/* CENTER: Timer */}
                <div className={`flex flex-col items-center ${isLowTime ? 'animate-pulse' : ''}`}>
                    <div className={`text-5xl font-mono font-light tracking-widest ${isLowTime ? 'text-red-500' : 'text-white'}`}>
                        {timeString}
                    </div>
                    <div className="text-white/30 text-[9px] tracking-[0.3em] font-bold uppercase mt-1">Round Time</div>
                </div>

                {/* RIGHT: Status */}
                <div className="flex flex-col items-end">
                    <div className="text-cyan-500 text-[10px] font-bold tracking-[0.2em] uppercase">Analysis</div>
                    <div className="text-2xl font-mono text-white tracking-widest">{currentPoseLabel}</div>
                </div>
            </div>

            {/* FEEDBACK: Bottom Center (Unobtrusive) */}
            {bonusText && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in zoom-in duration-200">
                    <div className={`px-6 py-2 bg-black/60 border-x-2 border-white/20 backdrop-blur-sm shadow-xl ${bonusText.color}`}>
                        <div className="text-xl font-bold font-mono tracking-widest uppercase text-center whitespace-nowrap">
                            {bonusText.msg}
                        </div>
                    </div>
                </div>
            )}

            {/* CRITICAL OVERLAY (Red Flash only on edges) */}
            {flashColor === 'red' && (
                <div className="absolute inset-0 z-40 pointer-events-none shadow-[inset_0_0_100px_rgba(220,38,38,0.5)] animate-pulse" />
            )}
        </>
    );
};
