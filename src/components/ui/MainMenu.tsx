import React from 'react';
import { Loader2, Camera } from 'lucide-react';

interface MainMenuProps {
    cameraReady: boolean;
    onStart: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ cameraReady, onStart }) => {
    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80">
            {!cameraReady ? (
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-16 h-16 text-cyan-400 animate-spin" />
                    <h2 className="text-2xl font-bold text-white">Initializing AI...</h2>
                </div>
            ) : (
                <button
                    onClick={onStart}
                    className="bg-white text-black px-12 py-6 text-3xl font-black rounded-full hover:scale-105 transition hover:bg-cyan-400 flex items-center gap-4"
                >
                    <Camera className="w-8 h-8" />
                    ENTER RING
                </button>
            )}
        </div>
    );
};
