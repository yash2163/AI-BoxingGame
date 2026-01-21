# CYBER BOX: Technical Whitepaper & Project Documentation

**Version:** 1.0.0
**Status:** Alpha / Active Development
**Developer:** Yash Rajput

---

## 1. Executive Summary

**Cyber Box** is a browser-based, **Mixed Reality (MR)** fitness game that democratizes the "Box VR" experience. By leveraging advanced **Computer Vision (CV)** and **Reinforcement Learning (RL)** directly in the web browser, it turns any standard webcam into a high-fidelity motion controller.

Unlike traditional gaming which relies on abstraction (pressing 'X' to punch), Cyber Box enforces physical execution, requiring players to actually duck, weave, and throw punches. This project bridges the gap between **expensive VR hardware** (Oculus, Vive) and **accessible web technologies**, proving that immersive fitness is possible without a headset.

---

## 2. Problem Statement & Market Gap

### The Problem
1.  **High Barrier to Immersive Fitness**: "VR Boxing" is the gold standard for gamified cardio, but it requires substantial investment ($400+ headset, $1500+ PC, or dedicated console).
2.  **Sedentary Gameplay**: Mobile and laptop games are predominantly passive. "Active" mobile games often suffer from poor tracking or gimmick-reliant controls (swiping).
3.  **Privacy & Latency**: Cloud-based AI solutions introduce unacceptable input lag (>100ms) and privacy concerns regarding streaming video to servers.

### The Cyber Box Solution
*   **Zero-Hardware Requirement**: Runs on any modern device (Laptop, Tablet) with a browser and webcam.
*   **Privacy-First Architecture**: **100% Client-Side Compute**. Video metrics are processed in GPU memory; no image data ever leaves the user's local machine.
*   **Sub-16ms Latency**: By running the AI pipeline alongside the render loop, we achieve 60 FPS responsiveness, crucial for a fast-paced reaction game.

---

## 3. Technical Architecture & Stack

### Core Technology Stack
| Layer | Technology | Justification |
| :--- | :--- | :--- |
| **Runtime** | **React 19 + Vite** | Provides a reactive UI layer for HUD/Menus while Vite ensures instant Hot Module Replacement (HMR) for rapid prototyping. |
| **Graphics** | **Three.js (@react-three/fiber)** | WebGL abstraction allowing for hardware-accelerated 3D rendering. R3F bridges the imperative nature of Three.js with React's declarative state. |
| **Computer Vision** | **TensorFlow.js (BlazePose)** | State-of-the-art pose estimation. We use the "Heavy" model for high accuracy (17 keypoints) or "Lite" for low-end devices. run on the WebGL backend. |
| **Audio** | **Web Audio API** | Procedural sound generation (oscillators/gain nodes) for zero-latency feedback, avoiding the I/O delay of loading static MP3s. |

### System Diagram
```mermaid
graph TD
    Webcam[Webcam Input] -->|Video Stream| TFJS[TensorFlow.js / BlazePose]
    TFJS -->|Keypoints (x,y)| FeatureExtractor[Feature Extractor]
    FeatureExtractor -->|Normalized Vector| KNN[KNN Classifier]
    KNN -->|Pose Label (e.g. 'DUCK')| GameLoop
    
    subgraph Game Loop (60 FPS)
        RL[RL Agent (Q-Table)] -->|Select Action| PunchManager
        PunchManager -->|Spawn Punch| Scene3D
        Scene3D -->|Active Hitboxes| CollisionSystem
        CollisionSystem -->|Check vs Player Head| Outcome
        Outcome -->|Reward/Penalty| RL
    end
    
    Scene3D -->|Render| Canvas
```

---

## 4. Artificial Intelligence Implementation

### A. Computer Vision (Pose Estimation)
We utilize **BlazePose**, a lightweight convolutional neural network optimized for mobile inference.
*   **Input**: 640x480 RGBA Video Frame.
*   **Output**: 33 Keypoints (3D coordinates). We focus on indices 0-10 (Face) and 11-16 (Shoulders/Elbows).
*   **Optimization**: We enable `simd` and `webgl` backends for TF.js to parallelize tensor math on the GPU.

### B. Motion Classification (KNN)
Raw coordinates are noisy. We implement a **K-Nearest Neighbors (KNN)** classifier.
1.  **Calibration Phase**: The user is guided to hold specific poses ("Duck", "Lean Left").
2.  **Feature Extraction**: We convert raw `(x,y)` into relative features:
    *   `Nose_X` relative to `Hip_Center_X`.
    *   `Nose_Y` relative to `Shoulder_Midpoint_Y`.
3.  **Inference**: Real-time frames are compared against these calibrated vectors. This solves the **"Height/Body Shape" variance** problem—the game adapts to a child or a giant automatically.

### C. Reinforcement Learning (The "Brain")
To prevent gameplay from becoming repetitive, the AI Opponent learns.
*   **Algorithm**: **Q-Learning (Multi-Armed Bandit)** with **Epsilon-Greedy Strategy**.
*   **State Space**: The User's ID.
*   **Action Space**: `{ LeftHook, RightHook, LeftStraight, RightStraight }`.
*   **Q-Table**: Stores confidence scores for each punch type.
    *   `Score > Base (0.5)`: The AI successfully landed this punch recently.
    *   `Score < Base`: The user consistently dodged this.
*   **Dynamics**: If a player has a weak "Left Side" guard, the AI's Q-Values for "Right Straight" will spike. The AI effectively "realizes" the weakness and exploits it until the player adjusts.

---

## 5. Gameplay Mechanics & Design

### The "Oval Theory" of Hit Detection
Traditional bounding boxes (AABB) are poor for head tracking. We implement **Elliptical Hit Zones**.
*   **Logic**: A punch is an object moving in 3D space (`z-axis`).
*   **Impact**: When `punch.z` approx. equals `camera.z`, we project the punch's 2D position.
*   **Detection**: We calculate the Euclidean distance between the `User.Nose` and the `Punch.Center`. If `Distance < HitThreshold + HeadRadius`, it's a Hit.
*   **Nuance**: Hooks require **Ducking** (Vertical displacement), while Straights require **Slipping** (Horizontal displacement). This is enforced via the `resolveCombat` logic which checks the classified pose label (`DUCK` vs `NEUTRAL`).

### "Juice" & Game Feel
To mitigate the lack of physical feedback (haptics), we use exaggerated audio-visual cues:
*   **Dolly Zoom**: The camera FoV tightens as a punch approaches, inducing a "flinch" response.
*   **Chromatic Aberration**: The screen splits RGB channels on impact (Glitch effect).
*   **Procedural Audio**: Pitch-shifted "Whoosh" sounds based on punch speed.

---

## 6. Future Scalability (VR/XR)

This architecture is **WebXR Ready**.
*   **Current**: 2D Screen + Webcam.
*   **Next Gen**: Using `<XR>` components from `@react-three/xr`, the exact same Three.js scene can be rendered in stereoscopic 3D on a Meta Quest 3 or Apple Vision Pro.
*   **Passthrough**: In AR mode, the "Opponent" would appear in the user's real living room, further dissolving the barrier between game and reality.

---

## 7. Conclusion

Cyber Box is not just a game; it is a technical proof-of-concept for **stateless, hardware-agnostic, AI-driven fitness**. By removing the friction of dedicated hardware and utilizing adaptive AI, it offers a sustainable and scalable model for the future of digital health.
