import { GoogleGenerativeAI } from "@google/generative-ai";
import type { FightEvent } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const getCoachingAdvice = async (history: FightEvent[]): Promise<string> => {
    if (!API_KEY) {
        console.warn("Missing VITE_GEMINI_API_KEY. Using placeholder feedback.");
        return "AI Coach unavailable. Please add VITE_GEMINI_API_KEY to your .env file to enable personalized feedback.";
    }

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Summarize history to save tokens/complexity if needed, or send raw
        // For now, raw history is fine for short rounds.
        const summary = JSON.stringify(history.slice(-30)); // Last 30 events to keep it focused

        const prompt = `
        You are an elite boxing coach. Analyze this fight log (JSON) from a VR boxing training session.
        Behavior Log: ${summary}
        
        Rules:
        - "HIT" means the player got hit (BAD).
        - "PERFECT" means they dodged correctly (GOOD).
        - "LUCKY/RISKY" means they dodged but with bad form (e.g. slipped a hook instead of ducking).
        
        Task:
        Provide exactly 3 bullet points of feedback.
        1. One positive observation.
        2. One critical mistake they kept making.
        3. One specific actionable tip for the next round.
        
        Keep it brief, punchy, and encouraging.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();

    } catch (error) {
        console.error("AI Implementation Error:", error);
        return "Coach is offline. (Check console for API error details)";
    }
};
