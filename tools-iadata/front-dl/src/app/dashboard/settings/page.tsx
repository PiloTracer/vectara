"use client";

import { useState, useEffect } from "react";
import { Check, Settings, Moon, Sun, Monitor, RefreshCw } from "lucide-react";

interface UserSettings {
    theme: 'light' | 'dark' | 'auto';
    showSources: boolean;
    autoScroll: boolean;
    maxContextChunks: number;
    useRAG: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
    theme: 'dark',
    showSources: true,
    autoScroll: true,
    maxContextChunks: 10,
    useRAG: true
};

export default function SettingsPage() {
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [saved, setSaved] = useState(false);

    // Load from localStorage
    useEffect(() => {
        const stored = localStorage.getItem("datalake_settings");
        if (stored) {
            try {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
            } catch (e) {
                console.error("Failed to parse settings", e);
            }
        }
    }, []);

    const saveSettings = () => {
        localStorage.setItem("datalake_settings", JSON.stringify(settings));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);

        // Dispatch event for other components to pick up changes
        window.dispatchEvent(new Event("settingsChanged"));
    };

    const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="max-w-3xl">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
                    <p className="text-slate-400">Customize your workspace preferences.</p>
                </div>
                <button
                    onClick={saveSettings}
                    className="
                        flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 
                        text-white rounded-lg transition-all font-medium
                    "
                >
                    {saved ? <Check className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                    {saved ? "Saved" : "Save Changes"}
                </button>
            </div>

            <div className="space-y-6">
                {/* Appearance */}
                <section className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-indigo-400" />
                        Appearance
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Theme</label>
                            <div className="flex gap-2 p-1 bg-slate-800 rounded-lg w-fit">
                                {[
                                    { value: 'light', icon: Sun, label: 'Light' },
                                    { value: 'dark', icon: Moon, label: 'Dark' },
                                    { value: 'auto', icon: Monitor, label: 'Auto' },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => updateSetting('theme', opt.value as any)}
                                        className={`
                                            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all
                                            ${settings.theme === opt.value
                                                ? 'bg-indigo-600 text-white shadow-lg'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-700'}
                                        `}
                                    >
                                        <opt.icon className="w-3 h-3" />
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Note: Currently forced to Dark Mode in this preview.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Chat Config */}
                <section className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-indigo-400" />
                        RAG Configuration
                    </h2>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between py-3 border-b border-slate-800">
                            <div>
                                <h3 className="text-sm font-medium text-slate-200">Enable RAG (Retrieval Augmented Generation)</h3>
                                <p className="text-xs text-slate-500">Allow AI to search your documents for answers.</p>
                            </div>
                            <Toggle
                                enabled={settings.useRAG}
                                onChange={(v) => updateSetting('useRAG', v)}
                            />
                        </div>

                        <div className="flex items-center justify-between py-3 border-b border-slate-800">
                            <div>
                                <h3 className="text-sm font-medium text-slate-200">Show Sources</h3>
                                <p className="text-xs text-slate-500">Display source file citations below answers.</p>
                            </div>
                            <Toggle
                                enabled={settings.showSources}
                                onChange={(v) => updateSetting('showSources', v)}
                            />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium text-slate-300">Max Context Chunks</label>
                                <span className="text-sm text-indigo-400 font-mono">{settings.maxContextChunks}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="20"
                                value={settings.maxContextChunks}
                                onChange={(e) => updateSetting('maxContextChunks', parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Higher values provide more context but may slow down generation.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!enabled)}
            className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                ${enabled ? 'bg-indigo-600' : 'bg-slate-700'}
            `}
        >
            <span
                className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${enabled ? 'translate-x-6' : 'translate-x-1'}
                `}
            />
        </button>
    );
}
