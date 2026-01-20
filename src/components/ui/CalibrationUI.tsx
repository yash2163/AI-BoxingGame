import React from 'react';

interface CalibrationProps {
    onLockPosition: () => void;
}

export const CalibrationUI: React.FC<CalibrationProps> = ({ onLockPosition }) => {
    return (
        <div className="absolute bottom-24 left-0 w-full flex justify-center z-50 pointer-events-auto">
            <button
                onClick={onLockPosition}
                className="bg-blue-600 text-white text-2xl font-bold px-12 py-4 rounded-full hover:scale-105 transition shadow-lg hover:bg-blue-700"
            >
                LOCK POSITION - START TRAINING
            </button>
        </div>
    );
};
