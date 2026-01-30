import type { NormalizeData, PoseFeatures, TemporalWindow } from '../types';

const WINDOW_SIZE = 6;
const SMOOTHING_ALPHA = 0.6;

const getAngle = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
    const rad = Math.atan2(cy - by, cx - bx) - Math.atan2(ay - by, ax - bx);
    let deg = Math.abs(rad * 180.0 / Math.PI);
    if (deg > 180) deg = 360 - deg;
    return deg / 180.0;
};

export class FeatureExtractor {
    private baseline: NormalizeData | null = null;
    private frameBuffer: PoseFeatures[] = [];
    private prevFeatures: PoseFeatures | null = null;
    private prevLandmarks: any[] | null = null;

    setBaseline(data: NormalizeData) {
        this.baseline = data;
        this.frameBuffer = [];
        this.prevFeatures = null;
    }

    recenter(rawLandmarks: any[]) {
        if (!this.baseline || !rawLandmarks || rawLandmarks.length < 33) return;

        const nose = rawLandmarks[0];
        const lSh = rawLandmarks[11];
        const rSh = rawLandmarks[12];
        const lHip = rawLandmarks[23];
        const rHip = rawLandmarks[24];

        // Update Center Points
        this.baseline.noseBase = { x: nose.x, y: nose.y };
        this.baseline.hipCenter = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };

        // Update Scale Factors (Handling distance change)
        // If user stands up and moves back, shoulders appear narrower. 
        // We must update width to keep sensitivity high.
        this.baseline.shoulderWidth = Math.abs(lSh.x - rSh.x);
        this.baseline.torsoHeight = Math.abs(((lSh.y + rSh.y) / 2) - ((lHip.y + rHip.y) / 2));
    }

    processFrame(rawLandmarks: any[]): { features: PoseFeatures | null, window: TemporalWindow | null } {
        // Guard Clause: Return empty object if not ready
        if (!this.baseline || !rawLandmarks || rawLandmarks.length < 33) {
            return { features: null, window: null };
        }

        // 1. Smooth Landmarks
        const landmarks = rawLandmarks.map((lm, i) => {
            if (!this.prevLandmarks) return lm;
            const prev = this.prevLandmarks[i];
            return {
                x: (SMOOTHING_ALPHA * lm.x) + ((1 - SMOOTHING_ALPHA) * prev.x),
                y: (SMOOTHING_ALPHA * lm.y) + ((1 - SMOOTHING_ALPHA) * prev.y),
                z: lm.z,
                visibility: lm.visibility
            };
        });
        this.prevLandmarks = landmarks;

        // 2. Extract Keypoints
        const nose = landmarks[0];
        const lSh = landmarks[11];
        const rSh = landmarks[12];
        const lHip = landmarks[23];
        const rHip = landmarks[24];
        const lKnee = landmarks[25];
        const rKnee = landmarks[26];

        const hipCenterX = (lHip.x + rHip.x) / 2;
        const hipCenterY = (lHip.y + rHip.y) / 2;
        const shCenterX = (lSh.x + rSh.x) / 2;
        const shCenterY = (lSh.y + rSh.y) / 2;

        // 3. Compute Features
        const head_dx = (nose.x - this.baseline.noseBase.x) / this.baseline.shoulderWidth;
        const head_dy = (nose.y - this.baseline.noseBase.y) / this.baseline.torsoHeight;

        const spine_angle = getAngle(hipCenterX, hipCenterY, shCenterX, shCenterY, shCenterX, shCenterY - 0.5);
        const hip_drop = (hipCenterY - this.baseline.hipCenter.y) / this.baseline.torsoHeight;

        const l_knee_ang = getAngle(lHip.x, lHip.y, lKnee.x, lKnee.y, lKnee.x, lKnee.y + 0.5);
        const r_knee_ang = getAngle(rHip.x, rHip.y, rKnee.x, rKnee.y, rKnee.x, rKnee.y + 0.5);

        // 4. Compute Velocity
        let vel_x = 0;
        let vel_y = 0;
        if (this.prevFeatures) {
            vel_x = head_dx - this.prevFeatures[0]; // Access index 0 (head_dx)
            vel_y = head_dy - this.prevFeatures[1]; // Access index 1 (head_dy)
        }

        const currentFeatures: PoseFeatures = [
            head_dx, head_dy, spine_angle, hip_drop,
            l_knee_ang, r_knee_ang, vel_x, vel_y
        ];

        this.prevFeatures = currentFeatures;

        // 5. Update Window
        this.frameBuffer.push(currentFeatures);
        if (this.frameBuffer.length > WINDOW_SIZE) this.frameBuffer.shift();

        return {
            features: currentFeatures,
            window: this.frameBuffer.length === WINDOW_SIZE ? this.frameBuffer.flat() : null
        };
    }
}