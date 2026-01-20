import React from 'react';
import { CalibrationOverlay as BaseOverlay } from '../CalibrationOverlay';
import type { GameState } from '../../types';

interface TrainingUIProps {
    gameState: GameState;
    overlayState: {
        title: string;
        sub: string;
        count: number | null;
        color: string;
        progress: number;
    } | null;
}

export const TrainingUI: React.FC<TrainingUIProps> = ({ gameState, overlayState }) => {
    if (gameState !== 'TRAINING_AI' || !overlayState) return null;

    return (
        <BaseOverlay
            title={overlayState.title}
            sub={overlayState.sub}
            count={overlayState.count}
            color={overlayState.color}
            progress={overlayState.progress}
        />
    );
};
