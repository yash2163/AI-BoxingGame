import React from 'react';
import { Loader2, Camera } from 'lucide-react';

interface MainMenuProps {
    cameraReady: boolean;
    onStart: () => void;
    speed: number;
    onSpeedChange: (speed: number) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ cameraReady, onStart, speed, onSpeedChange }) => {
    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80">
            {!cameraReady ? (
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-16 h-16 text-cyan-400 animate-spin" />
                    <h2 className="text-2xl font-bold text-white">Initializing AI...</h2>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-300">
                    <div className="flex flex-col items-center gap-2">
                        <h1 className="text-6xl font-black italic bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                            CYBER BOX
                        </h1>
                        <p className="text-cyan-100/60 uppercase tracking-widest text-sm">AI Training Module</p>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-900/50 p-4 rounded-xl backdrop-blur border border-white/10">
                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider w-20">Game Speed</span>
                        <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={speed}
                            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                            className="w-48 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        />
                        <span className="text-xl font-mono font-bold w-12 text-right">{speed.toFixed(1)}x</span>
                    </div>

                    <button
                        onClick={onStart}
                        className="group relative bg-white text-black px-12 py-6 text-3xl font-black rounded-full hover:scale-105 transition hover:bg-cyan-400 flex items-center gap-4 shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(34,211,238,0.6)]"
                    >
                        <Camera className="w-8 h-8 group-hover:rotate-12 transition" />
                        ENTER RING
                    </button>

                    <div className="text-white/30 text-xs mt-8">
                        Stand 6-8 feet away • Ensure good lighting
                    </div>
                </div>
            )}
        </div>
    );
};
