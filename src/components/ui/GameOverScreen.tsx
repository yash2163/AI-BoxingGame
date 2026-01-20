import React from 'react';
import Markdown from 'markdown-to-jsx';

interface GameOverScreenProps {
    score: number;
    onRestart: () => void;
    onGetFeedback: () => void;
    aiFeedback: string;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ score, onRestart, onGetFeedback, aiFeedback }) => {
    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-500 pointer-events-auto">
            <h2 className="text-6xl font-black text-white mb-8">GAME OVER</h2>
            <div className="text-4xl text-cyan-400 mb-12">Score: {score}</div>
            <button
                onClick={onRestart}
                className="bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-cyan-400 transition"
            >
                PLAY AGAIN
            </button>

            <button onClick={onGetFeedback} className="mt-8 text-cyan-400 underline font-bold">
                {aiFeedback === "Analyzing..." ? "Thinking..." : "Get AI Feedback"}
            </button>

            {aiFeedback && aiFeedback !== "Analyzing..." && (
                <div className="mt-4 p-6 bg-gray-800 rounded-xl max-w-2xl border border-gray-700">
                    <Markdown>{aiFeedback}</Markdown>
                </div>
            )}
        </div>
    );
};
