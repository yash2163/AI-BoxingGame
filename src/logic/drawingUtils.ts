export const drawSkeleton = (ctx: CanvasRenderingContext2D, landmarks: any[]) => {
    if (!landmarks || landmarks.length === 0) return;

    // MediaPipe Pose Landmarks Mapping
    // 0: nose, 1: left_eye_inner, 2: left_eye, 3: left_eye_outer, ...
    // 11: left_shoulder, 12: right_shoulder
    // 13: left_elbow, 14: right_elbow
    // 15: left_wrist, 16: right_wrist
    // 23: left_hip, 24: right_hip
    // 25: left_knee, 26: right_knee
    // 27: left_ankle, 28: right_ankle

    const CONNECTIONS = [
        [11, 12], // Shoulders
        [11, 13], [13, 15], // Left Arm
        [12, 14], [14, 16], // Right Arm
        [11, 23], [12, 24], // Torso
        [23, 24], // Hips
        [23, 25], [25, 27], // Left Leg
        [24, 26], [26, 28]  // Right Leg
    ];

    // Style Configuration
    const JOINT_COLOR = '#00e5ff'; // Cyan
    const LINE_COLOR = 'rgba(0, 229, 255, 0.4)'; // Cyan transparent
    const LINE_WIDTH = 4;
    const JOINT_RADIUS = 4;

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // 1. Draw Connections
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';

    CONNECTIONS.forEach(([i, j]) => {
        const p1 = landmarks[i];
        const p2 = landmarks[j];

        if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
            ctx.beginPath();
            ctx.moveTo(p1.x * width, p1.y * height);
            ctx.lineTo(p2.x * width, p2.y * height);
            ctx.stroke();
        }
    });

    // 2. Draw Joints (Shoulders, Elbows, Wrists, Hips + Face for Cyber Look)
    // 0: Nose, 2/5: Eyes, 7/8: Ears
    const RELEVANT_LANDMARKS = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24];

    ctx.fillStyle = JOINT_COLOR;
    RELEVANT_LANDMARKS.forEach(idx => {
        const p = landmarks[idx];
        if (p && p.visibility > 0.5) {
            ctx.beginPath();
            ctx.arc(p.x * width, p.y * height, JOINT_RADIUS, 0, 2 * Math.PI);
            ctx.fill();

            // Add Glow
            ctx.shadowColor = JOINT_COLOR;
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset
        }
    });
};
