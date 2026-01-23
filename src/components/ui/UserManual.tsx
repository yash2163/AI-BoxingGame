import React from 'react';
import { ArrowLeft, Target, Eye, Trophy } from 'lucide-react';

interface UserManualProps {
    onBack: () => void;
}

export const UserManual: React.FC<UserManualProps> = ({ onBack }) => {
    return (
        <div className="absolute inset-0 z-50 flex flex-col bg-black/95 text-white overflow-y-auto">
            {/* HEADER */}
            <div className="p-8 flex items-center gap-4 border-b border-white/10 bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
                <button
                    onClick={onBack}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-black italic text-cyan-400">OPERATOR MANUAL //_V1.0</h1>
            </div>

            <div className="max-w-4xl mx-auto w-full p-8 pb-32 flex flex-col gap-12">

                {/* 1. SCORING SYSTEM */}
                <section className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-10 duration-500">
                    <div className="flex items-center gap-3 text-yellow-400">
                        <Trophy className="w-8 h-8" />
                        <h2 className="text-2xl font-bold uppercase">Scoring Matrix</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-green-900/30 border border-green-500/30 p-6 rounded-xl flex flex-col gap-2">
                            <div className="text-4xl font-black text-green-400">+300</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-green-200">Perfect Dodge</div>
                            <p className="text-xs text-green-100/60">Flawless execution. Correct counter-move.</p>
                        </div>

                        <div className="bg-orange-900/30 border border-orange-500/30 p-6 rounded-xl flex flex-col gap-2">
                            <div className="text-4xl font-black text-orange-400">+50</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-orange-200">Risky Move</div>
                            <p className="text-xs text-orange-100/60">Bad form. Slipping a straight instead of ducking.</p>
                        </div>

                        <div className="bg-red-900/30 border border-red-500/30 p-6 rounded-xl flex flex-col gap-2">
                            <div className="text-4xl font-black text-red-500">-100</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-red-200">Hit Taken</div>
                            <p className="text-xs text-red-100/60">Head entered the damage zone.</p>
                        </div>
                    </div>
                </section>

                {/* 2. THE OVAL THEORY */}
                <section className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-100">
                    <div className="flex items-center gap-3 text-cyan-400">
                        <Target className="w-8 h-8" />
                        <h2 className="text-2xl font-bold uppercase">The "Oval" Logic</h2>
                    </div>

                    <div className="bg-gray-900/80 p-8 rounded-2xl border border-white/5 space-y-4">
                        <p className="text-lg leading-relaxed text-gray-300">
                            Cyber Box doesn't just use simple boxes. We track your head movement in <strong className="text-cyan-400">Elliptical Zones</strong>.
                        </p>
                        <ul className="space-y-3 list-disc list-inside text-gray-400 pl-4">
                            <li><strong className="text-white">Straight Punches:</strong> Require horizontal movement (Slips).</li>
                            <li><strong className="text-white">Hooks:</strong> Require vertical movement (Ducks).</li>
                            <li><strong className="text-white">The Zone:</strong> If your nose stays inside the punch's "oval" at impact time, you get hit.</li>
                        </ul>
                        <div className="p-4 bg-blue-500/20 rounded border border-blue-500/30 text-blue-200 text-sm">
                            <span className="font-bold">PRO TIP:</span> Move early! The "Dodge Window" opens when the punch is 75% of the way to you.
                        </div>
                    </div>
                </section>

                {/* 3. SETUP */}
                <section className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-200">
                    <div className="flex items-center gap-3 text-purple-400">
                        <Eye className="w-8 h-8" />
                        <h2 className="text-2xl font-bold uppercase">Optimal Setup</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="bg-white/5 p-6 rounded-xl flex flex-col gap-2">
                            <h3 className="font-bold text-white">Lighting</h3>
                            <p className="text-white/60">Ensure your face is evenly lit. Avoid strong backlighting (windows behind you).</p>
                        </div>
                        <div className="bg-white/5 p-6 rounded-xl flex flex-col gap-2">
                            <h3 className="font-bold text-white">Distance</h3>
                            <p className="text-white/60">Stand 6-8 feet back. We need to see your hips for accurate torso tracking.</p>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
};
