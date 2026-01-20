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
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
            <div className="flex flex-col items-center gap-8 animate-in zoom-in duration-100">

                {/* Main Title */}
                <div className={`text-6xl font-black ${color} uppercase text-center drop-shadow-lg`}>
                    {title}
                </div>

                {/* Instruction Box */}
                <div className="text-2xl font-bold text-slate-800 tracking-widest uppercase bg-white/90 px-8 py-4 rounded-xl shadow-lg border border-slate-200">
                    {sub}
                </div>

                {/* Countdown Timer */}
                {count !== null && (
                    <div className="text-[150px] font-black text-white animate-pulse drop-shadow-2xl">
                        {count}
                    </div>
                )}

                {/* Recording Spinner */}
                {title === "HOLD STILL!" && (
                    <ScanFace className="w-24 h-24 text-red-500 animate-spin" />
                )}

                {/* Progress Bar (Legacy Style) */}
                {progress !== undefined && progress > 0 && (
                    <div className="w-96 h-6 bg-gray-700 rounded-full mt-8 overflow-hidden border border-white/20">
                        <div
                            className="h-full bg-green-500 transition-all duration-75 ease-linear"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};