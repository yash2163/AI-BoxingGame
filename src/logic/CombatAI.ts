import type { PunchType, PunchSide } from "../types";

// TYPES
export type ActionName = 'LeftStraight' | 'RightStraight' | 'LeftHook' | 'RightHook';

interface QTable {
    [key: string]: number; // Action -> Score
}

interface PlayerProfile {
    name: string;
    qTable: QTable;
    gamesPlayed: number;
}

// CONFIG
const LEARNING_RATE = 0.2; // How fast we adapt (0.1 - 0.5)
const DISCOUNT_FACTOR = 0.9; // Not strictly used in Bandit, but good habit
const EXPLORATION_RATE = 0.2; // 20% Chance to do random move (Epsilon)
const REWARD_HIT = 2.0;       // Big reward for landing
const REWARD_MISS = -1.0;     // Penalty for missing

export class CombatAI {
    private currentPlayer: string = "Guest";
    private qTable: QTable = {
        'LeftStraight': 0.5,
        'RightStraight': 0.5,
        'LeftHook': 0.5,
        'RightHook': 0.5
    };

    // --- 1. SESSION MANAGEMENT ---

    public loadProfile(playerName: string) {
        if (!playerName) return;
        this.currentPlayer = playerName;

        const saved = localStorage.getItem(`cyberbox_ai_${playerName}`);
        if (saved) {
            try {
                const profile: PlayerProfile = JSON.parse(saved);
                this.qTable = profile.qTable;
                console.log(`[AI] Loaded profile for ${playerName}`, this.qTable);
            } catch (e) {
                console.error("Corrupt AI Save", e);
                this.resetTable();
            }
        } else {
            console.log(`[AI] New profile for ${playerName}`);
            this.resetTable();
        }
    }

    private saveProfile() {
        if (this.currentPlayer === "Guest") return;

        const profile: PlayerProfile = {
            name: this.currentPlayer,
            qTable: this.qTable,
            gamesPlayed: 1 // We could increment this
        };
        localStorage.setItem(`cyberbox_ai_${this.currentPlayer}`, JSON.stringify(profile));
    }

    private resetTable() {
        this.qTable = {
            'LeftStraight': 0.5,
            'RightStraight': 0.5,
            'LeftHook': 0.5,
            'RightHook': 0.5
        };
    }

    // --- 2. DECISION ENGINE (Epsilon-Greedy) ---

    public chooseAction(): ActionName {
        const actions = Object.keys(this.qTable) as ActionName[];

        // A. EXPLORATION (Random)
        if (Math.random() < EXPLORATION_RATE) {
            // console.log("[AI] Exploring...");
            return actions[Math.floor(Math.random() * actions.length)];
        }

        // B. EXPLOITATION (Best Score)
        // Find action with highest Q-Value
        let bestAction = actions[0];
        let maxVal = -Infinity;

        actions.forEach(act => {
            if (this.qTable[act] > maxVal) {
                maxVal = this.qTable[act];
                bestAction = act;
            }
        });

        // console.log(`[AI] Exploiting weakness: ${bestAction} (${maxVal.toFixed(2)})`);
        return bestAction;
    }

    // --- 3. LEARNING ENGINE (Bellman Update) ---
    // successful: Did the punch LAND? (HIT = true, BLOCKED/DODGED = false)
    public updateModel(action: ActionName, successful: boolean) {
        const oldQ = this.qTable[action];
        const reward = successful ? REWARD_HIT : REWARD_MISS;

        // Simple Bandit Update Rule:
        // New = Old + Alpha * (Reward - Old)
        const newQ = oldQ + LEARNING_RATE * (reward - oldQ);

        this.qTable[action] = newQ;

        // Debug
        // console.log(`[AI Update] ${action}: ${oldQ.toFixed(2)} -> ${newQ.toFixed(2)} (Reward: ${reward})`);

        this.saveProfile();
    }

    // Helper to get punch details from string
    public getPunchDetails(action: ActionName): { side: PunchSide, type: PunchType } {
        const side = action.toLowerCase().includes('left') ? 'left' : 'right';
        const type = action.toLowerCase().includes('hook') ? 'hook' : 'straight';
        return { side, type };
    }
}

export const combatAI = new CombatAI();
