# Start of RL Plan
# Reinforcement Learning (RL) Plan for Cyber-Box

## 1. The Core Concept: Multi-Armed Bandit (Q-Learning Lite)
We are treating the Opponent as an agent trying to maximize its "Damage Output".
It has a set of actions (Arms of the Bandit):
- Left Straight
- Right Straight
- Left Hook
- Right Hook

Instead of a complex Neural Network state machine, we use a probability engine that adapts based on history.

## 2. The Model: Q-Table
For each Player (User Profile), we store a Q-Table in `localStorage`.
Structure:
```json
{
  "playerName": "Yash",
  "qTable": {
    "LeftStraight": 0.5,
    "RightStraight": 0.5,
    "LeftHook": 0.5,
    "RightHook": 0.5
  },
  "gamesPlayed": 12
}
```
*Initial Value (0.5)* represents neutral confidence.

## 3. The Math (Bellman Equation Simplified)
We update the score ($Q$) of a move ($a$) after every result ($r$) using a Learning Rate ($\alpha$):

$$Q_{new}(a) = Q_{old}(a) + \alpha \cdot (Reward - Q_{old}(a))$$

**Parameters:**
- **Learning Rate ($\alpha$)**: `0.1` (Fast adaptation, but remembers history).
- **Rewards**:
    - **HIT (Land)**: `+2.0` (Big incentive to repeat)
    - **BLOCK/DODGE (Miss)**: `-1.0` (Discourage, but punish less than Hit rewards).

## 4. The Policy: Epsilon-Greedy
How does the AI choose a punch?
It doesn't *always* pick the highest score (that would be predictable).
It uses **$\epsilon$-Greedy Strategy**:

- **$\epsilon$ (Exploration Rate)**: `0.2` (20% chance).
- **Logic**:
    - Roll a dice (0-1).
    - If `roll < 0.2`: **Explore** (Pick a random punch). *Test if the player is sleeping.*
    - If `roll > 0.2`: **Exploit** (Pick the punch with the highest Q-Score). *Spam the weakness.*

## 5. Why This Approach?
1.  **Computationally Free**: No heavy matrix math. Runs perfectly in JS loop.
2.  **Instant Feedback**: The AI adapts within a *single round*.
3.  **Persistency**: By saving to LocalStorage, the AI "remembers" you tomorrow. "Oh, it's Yash. He can't block hooks."

## 6. Implementation Steps
1.  **`CombatAI.ts`**: The logic class handling the Q-Table and selection.
2.  **`Logic/Storage`**: LocalStorage wrapper for User Profiles.
3.  **`MainMenu`**: Input field for Player Name.
4.  **`Game Loop`**: Replace `Math.random()` punch selection with `CombatAI.chooseAction()`.
5.  **`Fight Resolution`**: Call `CombatAI.update(action, outcome)` after every punch.
