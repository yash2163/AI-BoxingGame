// import * as tf from '@tensorflow/tfjs';
// import type { PoseClass, TemporalWindow } from '../types';

// // MAPPING
// const CLASS_MAP: PoseClass[] = ['NEUTRAL', 'LEFT', 'RIGHT', 'DUCK'];

// export class PoseClassifier {
//     private model: tf.Sequential | null = null;
//     private data: { features: number[], label: number }[] = [];
//     private isTraining = false;

//     constructor() {
//         this.initModel();
//     }

//     private initModel() {
//         // Initialize an empty model architecture
//         this.model = tf.sequential();
//         this.model.add(tf.layers.dense({ inputShape: [48], units: 32, activation: 'relu' }));
//         this.model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
//         this.model.add(tf.layers.dense({ units: 4, activation: 'softmax' }));

//         this.model.compile({
//             optimizer: tf.train.adam(0.001),
//             loss: 'categoricalCrossentropy',
//             metrics: ['accuracy']
//         });
//     }

//     /**
//      * Store a sample during Calibration Phase
//      */
//     addExample(className: PoseClass, window: TemporalWindow) {
//         const labelIndex = CLASS_MAP.indexOf(className);
//         if (labelIndex === -1) return;

//         this.data.push({
//             features: window,
//             label: labelIndex
//         });
//     }

//     /**
//      * Train the model in-browser
//      */
//     async train() {
//         if (this.data.length === 0 || !this.model) return;
//         this.isTraining = true;

//         // Convert data to Tensors
//         // tf.tidy cannot be used here because we need these tensors for the duration of the async fit
//         const inputs = tf.tensor2d(this.data.map(d => d.features));
//         const labels = tf.oneHot(tf.tensor1d(this.data.map(d => d.label), 'int32'), 4);

//         console.log(`[🧠 AI] Training on ${this.data.length} samples...`);

//         try {
//             await this.model.fit(inputs, labels, {
//                 epochs: 25,
//                 batchSize: 16,
//                 shuffle: true,
//                 callbacks: {
//                     onTrainEnd: () => console.log("[🧠 AI] Training Complete.")
//                 }
//             });
//         } finally {
//             this.isTraining = false;
//             // MEMORY FIX: Always dispose tensors, even if training fails
//             inputs.dispose();
//             labels.dispose();
//         }
//     }

//     /**
//      * Predict Pose in Real-Time
//      */
//     async predict(window: TemporalWindow): Promise<PoseClass> {
//         if (this.isTraining || !this.model) return 'NEUTRAL';

//         // MEMORY FIX: We must capture every intermediate tensor to dispose it
//         const input = tf.tensor2d([window]);
//         const prediction = this.model.predict(input) as tf.Tensor;
//         const indices = prediction.argMax(1); // Creates a new tensor!

//         // Download data from GPU (async)
//         const labelIndex = (await indices.data())[0];

//         // Cleanup ALL tensors
//         input.dispose();
//         prediction.dispose();
//         indices.dispose(); // <--- This was missing in your code

//         return CLASS_MAP[labelIndex];
//     }

//     /**
//      * Clear data to restart calibration
//      */
//     reset() {
//         this.data = [];

//         // MEMORY FIX: Dispose the old model's weights before creating a new one
//         if (this.model) {
//             this.model.dispose();
//         }

//         this.initModel();
//     }
// }




















import type { PoseClass, TemporalWindow } from '../types';

// CONFIG
const K = 5; // Look at the 5 nearest neighbors

export class KNNClassifier {
    private examples: { features: number[], label: PoseClass }[] = [];

    constructor() {
        this.reset();
    }

    /**
     * Store a sample (Instant "Training")
     */
    addExample(className: PoseClass, window: TemporalWindow) {
        this.examples.push({
            features: [...window], // Copy array to prevent ref issues
            label: className
        });
    }

    /**
     * "Train" is just a placeholder now since KNN is lazy-learning.
     * We keep the async signature to match the interface, but it returns instantly.
     */
    async train() {
        console.log(`[KNN] Learned ${this.examples.length} poses. Ready.`);
        return Promise.resolve();
    }

    /**
     * Find the K nearest neighbors and vote
     */
    predict(window: TemporalWindow): PoseClass {
        if (this.examples.length === 0) return 'NEUTRAL';

        // 1. Calculate Distances to all known examples
        const distances = this.examples.map(ex => ({
            label: ex.label,
            dist: this.euclideanDistance(window, ex.features)
        }));

        // 2. Sort by distance (smallest first) and take top K
        distances.sort((a, b) => a.dist - b.dist);
        const kNearest = distances.slice(0, K);

        // 3. Majority Vote
        const counts: Record<string, number> = { NEUTRAL: 0, LEFT: 0, RIGHT: 0, DUCK: 0 };

        kNearest.forEach(neighbor => {
            counts[neighbor.label]++;
        });

        // 4. Find Winner
        let winner: PoseClass = 'NEUTRAL';
        let maxVotes = -1;

        (Object.keys(counts) as PoseClass[]).forEach(pose => {
            if (counts[pose] > maxVotes) {
                maxVotes = counts[pose];
                winner = pose;
            }
        });

        return winner;
    }

    reset() {
        this.examples = [];
    }

    // --- MATH HELPER ---
    private euclideanDistance(a: number[], b: number[]): number {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            const diff = a[i] - b[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }
}