# 🥊 Cyber Box: Real-Time AI Boxing Coach

![Cyber Box Demo](https://img.shields.io/badge/Status-Active-success) ![License](https://img.shields.io/badge/License-MIT-blue) ![Tech](https://img.shields.io/badge/Stack-React%20|%20TensorFlow.js%20|%20Three.js-orange)

**Cyber Box** is an interactive 3D fitness game that turns your webcam into a motion controller. Running entirely client-side at 60 FPS, it uses Computer Vision to track your boxing form (Ducks, Slips, Weaves) and Generative AI to provide personalized coaching.

> **Goal:** Democratize fitness tech by replacing expensive hardware (VR/Kinect) with standard browser capabilities and smart engineering.

---

## 🚀 Features

### 👁️ Real-Time Biomechanics Tracking
* **Zero-Hardware Required:** Uses **MediaPipe Pose** to track 33 skeletal landmarks via a standard webcam.
* **Custom Feature Extraction:** Instead of raw noisy coordinates, the system calculates normalized biomechanical vectors (Spine Angle, Hip Drop, Velocity) to ensure accuracy across different body types and camera distances.

### 🧠 Adaptive ML Core (The "Brain")
* **Instant Calibration:** Uses a **K-Nearest Neighbors (KNN)** classifier for "Few-Shot Learning." The model trains on *your* specific body mechanics in under 3 seconds during the calibration phase.
* **No Cold Start:** Unlike heavy Deep Learning models, this lightweight approach requires no pre-training data and runs with near-zero latency.

### 🎮 Reactive 3D Gameplay
* **"Oval Theory" Hitboxes:** Implements elliptical threat zones rather than simple box collisions. This forces players to use proper boxing form (e.g., slipping laterally vs. ducking vertically) to avoid damage.
* **Adaptive Opponent:** The enemy AI uses probability weights (inspired by Q-Learning) to exploit your movement patterns. If you only duck, it starts throwing uppercuts.

### 🤖 Generative AI Coach
* Integrated **Google Gemini 1.5 Flash API**.
* Post-match, the system sends structured fight logs to the LLM, which acts as a virtual corner-man providing specific, actionable advice based on your performance data.

---

## 🛠️ The Engineering (Under the Hood)

This project solves the "Death Loop" challenge common in browser-based AI: running a 3D Render Cycle alongside an ML Inference Loop without crashing the main thread.

### 1. Ref-First Architecture
To achieve a smooth 60 FPS, I decoupled the high-frequency logic from React's render cycle.
* **Game State:** Managed via `useRef` (Mutable, Synchronous, No Re-renders).
* **UI State:** Managed via `useState` (Asynchronous, Scheduled updates).
* **Result:** The physics engine and pose detector run at full speed, independent of UI updates.

### 2. Silent Timer System
A custom timing hook ensures that React's component lifecycle doesn't interfere with the combat rhythm, preventing race conditions where the game loop would "eat" punch events during re-renders.

### 3. Dynamic Normalization
The `FeatureExtractor` captures a baseline "Neutral Stance" at the start of the round. All subsequent movements are calculated as ratios relative to this baseline, making the game robust to players moving around the room.

---

## 💻 Tech Stack

* **Frontend:** React 18, TypeScript, Vite
* **ML & Vision:** TensorFlow.js, MediaPipe Pose, KNN Classifier
* **Graphics:** Three.js, React Three Fiber (R3F), Drei
* **Styling:** Tailwind CSS
* **AI API:** Google Gemini 1.5 Flash

---

## ⚡ Getting Started

### Prerequisites
* Node.js (v16+)
* A webcam
* A Google Gemini API Key (Get it [here](https://aistudio.google.com/))

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/yourusername/cyber-box.git](https://github.com/yourusername/cyber-box.git)
    cd cyber-box
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Setup Environment Variables**
    Create a `.env` file in the root directory:
    ```env
    VITE_GEMINI_API_KEY=your_api_key_here
    ```

4.  **Run the Development Server**
    ```bash
    npm run dev
    ```

5.  Open `http://localhost:5173` in your browser. Allow camera permissions and start boxing!

---

## 🕹️ How to Play

1.  **Calibration:** Stand 6-8 feet back. Follow the on-screen prompts (Neutral, Slip Left, Slip Right, Duck). This trains the AI on *your* body.
2.  **The Fight:**
    * **Straights (Long Punches):** Slip Left or Right to dodge.
    * **Hooks (Wide Punches):** Duck under them.
    * **Don't Camp:** If you stay in a dodge position too long, the AI will catch you.
3.  **The Coach:** After the round, read the AI analysis to improve your form.

---

## 🔮 Roadmap

* [ ] **Multiplayer:** WebRTC implementation for real-time PvP shadow boxing.
* [ ] **VR Mode:** WebXR support for Quest/Vision Pro.
* [ ] **Combo Recognition:** Detecting player punches (Shadow Boxing offense) using velocity thresholds.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request for any bugs or features.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Built with 🥊 by Yash Rajput ** *Data Scientist | Full-Stack AI Engineer*
