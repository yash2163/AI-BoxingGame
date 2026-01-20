import { useRef, useEffect, useState } from 'react';
import type { RefObject } from 'react';

// Configuration
const MP_VERSION = "0.5.1675469404";

// Types
interface PoseTrackingResult {
    image: HTMLImageElement;
    poseLandmarks?: any[]; // Using any for brevity, though types exist in @types/three ideally
}

interface UsePoseTrackingProps {
    videoRef: RefObject<HTMLVideoElement | null>;
    onResults: (results: PoseTrackingResult) => void;
    modelComplexity?: 0 | 1 | 2;
    enableSmoothing?: boolean;
}

export const usePoseTracking = ({
    videoRef,
    onResults,
    modelComplexity = 1,
    enableSmoothing = true
}: UsePoseTrackingProps) => {
    const [isCameraReady, setCameraReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs to store instances
    const poseRef = useRef<any>(null);
    const cameraRef = useRef<any>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        const loadPoseStack = async () => {
            try {
                // 1. Dynamic Injection
                if (!(window as any).Pose) {
                    console.log("Loading MediaPipe Pose...");
                    const script = document.createElement('script');
                    script.src = `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${MP_VERSION}/pose.js`;
                    script.async = true;
                    script.crossOrigin = "anonymous";
                    document.body.appendChild(script);
                    await new Promise((resolve, reject) => {
                        script.onload = resolve;
                        script.onerror = () => reject("Failed to load MediaPipe Pose script.");
                    });
                }

                if (!isMountedRef.current) return;

                // 2. Initialize Pose
                const Pose = (window as any).Pose;
                poseRef.current = new Pose({
                    locateFile: (file: string) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${MP_VERSION}/${file}`
                });

                poseRef.current.setOptions({
                    modelComplexity,
                    smoothLandmarks: enableSmoothing,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                poseRef.current.onResults((results: any) => {
                    if (isMountedRef.current) {
                        onResults(results);
                    }
                });

                // 3. Initialize Camera
                if (videoRef.current) {
                    if (!(window as any).Camera) {
                        // Note: MediaPipe Camera Utils often come bundled or need separate injection
                        // In the original code, it seemed to rely on global Camera which might be from camera_utils.js
                        // If not present, we might need to inject that too.
                        // For now, assuming similar environment as original
                    }

                    // Just in case Camera is not globally available, we might need to handle it.
                    // But looking at original code: `cameraRef.current = new window.Camera(...)`
                    // It implies `window.Camera` is expected.

                    // IMPORTANT: The original code didn't inject camera_utils.js explicitly in the snippet shown,
                    // but usually it is required. It might be in index.html?
                    // Let's assume for now it works as in original, or we might need to add injection logic.
                    // Actually, `window.Camera` usually comes from `@mediapipe/camera_utils`.
                    // If it's not checked here, let's add a check.

                    if (!(window as any).Camera) {
                        console.log("Loading Camera Utils...");
                        const script = document.createElement('script');
                        script.src = `https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js`;
                        script.async = true;
                        script.crossOrigin = "anonymous";
                        document.body.appendChild(script);
                        await new Promise((resolve, reject) => {
                            script.onload = resolve;
                            script.onerror = () => reject("Failed to load Camera Utils script.");
                        });
                    }

                    const Camera = (window as any).Camera;
                    cameraRef.current = new Camera(videoRef.current, {
                        onFrame: async () => {
                            if (isMountedRef.current && videoRef.current && poseRef.current) {
                                await poseRef.current.send({ image: videoRef.current });
                            }
                        },
                        width: 1280,
                        height: 720
                    });

                    await cameraRef.current.start();
                    if (isMountedRef.current) setCameraReady(true);
                }

            } catch (err: any) {
                console.error("Pose tracking initialization failed:", err);
                if (isMountedRef.current) setError(err.message || "Unknown error");
            }
        };

        loadPoseStack();

        return () => {
            isMountedRef.current = false;
            if (cameraRef.current) {
                // Some Camera implementations have .stop(), some don't. Safe check.
                if (typeof cameraRef.current.stop === 'function') cameraRef.current.stop();
            }
            if (poseRef.current) {
                if (typeof poseRef.current.close === 'function') poseRef.current.close();
            }
        };
    }, [videoRef, modelComplexity, enableSmoothing]);
    // Note: Removed onResults from deps to avoid re-init loops. 
    // The user should wrap onResults in useCallback, but even if they don't, 
    // we don't want to re-run the entire initialization.
    // However, poseRef.current.onResults IS updated dynamically below if needed?
    // Actually, `poseRef.current.onResults` registers a callback. 
    // If `onResults` changes, we actally WANT to update the listener without re-init.

    // Better pattern: store latest onResults in a ref to call inside the persistent callback.
    const onResultsRef = useRef(onResults);
    useEffect(() => {
        onResultsRef.current = onResults;
    }, [onResults]);

    useEffect(() => {
        if (poseRef.current) {
            poseRef.current.onResults((results: any) => {
                if (isMountedRef.current && onResultsRef.current) {
                    onResultsRef.current(results);
                }
            });
        }
    }, [onResults]);


    return { isCameraReady, error };
};
