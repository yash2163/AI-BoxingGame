import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DodgeRating, PunchType, PunchSide, PoseClass } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Rate limiting and configuration
const COOLDOWN_MS = 6000; // Minimum time between comments


export interface CoachEvent {
    punchType: PunchType;
    punchSide: PunchSide;
    outcome: DodgeRating;
    userMove: PoseClass;
}

export class RealTimeCoachService {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private lastSpeakTime: number = 0;
    private isProcessing: boolean = false;
    private synth: SpeechSynthesis;
    private voice: SpeechSynthesisVoice | null = null;

    constructor() {
        if (!API_KEY) {
            console.warn("RealTimeCoach: VITE_GEMINI_API_KEY is missing.");
        }
        this.genAI = new GoogleGenerativeAI(API_KEY || "");
        // Use Flash for speed
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        this.synth = window.speechSynthesis;

        // Try to load voices
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = this.loadVoices.bind(this);
        }
        this.loadVoices();
    }

    private loadVoices() {
        const voices = this.synth.getVoices();
        // Prefer a fast, clear English voice. 'Daniel' (UK) or 'Google US English' are good.
        this.voice = voices.find(v => v.name.includes("Daniel")) ||
            voices.find(v => v.lang === "en-US") ||
            null;
    }

    public async analyzeInteraction(imageBase64: string, event: CoachEvent) {
        if (this.isProcessing) return; // Busy
        if (Date.now() - this.lastSpeakTime < COOLDOWN_MS) return; // Cooldown

        // Priority Logic: Skip "Perfect" moves if we are just spamming praise. 
        // Focus on "HIT" (mistakes) or "RISKY" moves.
        if (event.outcome !== 'HIT' && event.outcome !== 'RISKY' && Math.random() > 0.3) {
            // 70% chance to skip positive feedback to keep it rare/valuable
            return;
        }

        this.isProcessing = true;

        try {
            // Remove data URL header if present for Gemini
            const base64Data = imageBase64.split(',')[1];

            const prompt = `
            You are a crisp, high-energy boxing coach.
            The player just encountered a ${event.punchSide} ${event.punchType}.
            Their Move: ${event.userMove}.
            Outcome: ${event.outcome}.
            
            Based on the outcome and the provided image of their form:
            Give a ONE-LINER coaching tip (max 10 words).
            - If HIT: Tell them what they did wrong (e.g., "Hands up!", "Too slow!", "Duck deeper!").
            - If RISKY: Warn them (e.g., "That was close, move faster!").
            - If PERFECT: Brief praise (e.g., "Sharp movement!", "Nice slip!").
            
            Speak directly to them. No formatting.
            `;

            const result = await this.model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: "image/jpeg",
                    },
                },
            ]);

            const response = await result.response;
            const text = response.text().trim();

            console.log(`[Coach]: ${text}`);
            this.speak(text);

        } catch (e) {
            console.error("Coach Error:", e);
        } finally {
            this.isProcessing = false;
        }
    }

    private speak(text: string) {
        if (this.synth.speaking) {
            this.synth.cancel(); // Interrupt previous if urgent? or maybe just skip
        }

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) utterance.voice = this.voice;
        utterance.rate = 1.2; // Speak slightly faster for urgency
        utterance.pitch = 1.0;

        this.synth.speak(utterance);
        this.lastSpeakTime = Date.now();
    }
}
