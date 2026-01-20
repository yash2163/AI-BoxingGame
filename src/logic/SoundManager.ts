export class SoundManager {
    private ctx: AudioContext | null = null;
    private enabled: boolean = false;

    constructor() {
        try {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.enabled = true;
        } catch (e) {
            console.error("AudioContext not supported");
        }
    }

    public resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // --- SYNTHETIC SOUNDS ---

    // 1. HIT (Low thud + noise)
    public playHit() {
        if (!this.ctx || !this.enabled) return;
        this.resume();

        const t = this.ctx.currentTime;

        // Oscillator for impact "thud"
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.2);

        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    // 2. DODGE/BLOCK (Whoosh/High beep)
    public playDodge() {
        if (!this.ctx || !this.enabled) return;
        this.resume();

        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(600, t + 0.1); // Slide up

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    // 3. WHOOSH (Ideally noise, but using low sine slide for now)
    public playWhoosh() {
        if (!this.ctx || !this.enabled) return;
        this.resume();

        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.2);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.1);
        gain.gain.linearRampToValueAtTime(0, t + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
    }
}

export const soundManager = new SoundManager();
