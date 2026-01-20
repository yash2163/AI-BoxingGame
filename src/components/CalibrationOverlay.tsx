import React from 'react';
import { ScanFace } from 'lucide-react';

interface Props {
    title: string;
    sub: string;
    count: number | null;
    color: string;
    progress?: number; // 0 to 100
}

export const CalibrationOverlay: React.FC<Props> = ({ title, sub, count, color, progress }) => {
    return (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-start pt-20 pointer-events-none">
            <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-100 w-full max-w-2xl px-4">

                {/* Main Title */}
                <div className={`text-5xl font-black ${color} uppercase text-center drop-shadow-lg`}>
                    {title}
                </div>

                {/* Instruction Box */}
                <div className="text-xl font-bold text-slate-800 tracking-widest uppercase bg-white/90 px-6 py-3 rounded-xl shadow-lg border border-slate-200">
                    {sub}
                </div>

                {/* Progress Bar (Moved closer to top info) */}
                {progress !== undefined && progress > 0 && (
                    <div className="w-full h-4 bg-gray-700/50 rounded-full mt-4 overflow-hidden border border-white/20 backdrop-blur">
                        <div
                            className="h-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] transition-all duration-75 ease-linear"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                {/* Countdown Timer (Keep large/centerish but slightly adjusted if needed, actually maybe keep it detached or just below) */}
                {count !== null && (
                    <div className="mt-10 text-[120px] font-black text-white animate-pulse drop-shadow-2xl">
                        {count}
                    </div>
                )}

                {/* Recording Spinner */}
                {title === "HOLD STILL!" && (
                    <ScanFace className="w-20 h-20 text-cyan-400 animate-spin mt-8" />
                )}
            </div>
        </div>
    );
};