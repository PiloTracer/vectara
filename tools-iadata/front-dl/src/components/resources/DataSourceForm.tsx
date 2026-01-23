"use client";

import React, { useState } from "react";
import { createSource } from "../../actions/resources";
import { Loader2, Folder, Link as LinkIcon, Save, X } from "lucide-react";

interface DataSourceFormProps {
    envId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export function DataSourceForm({ envId, onSuccess, onCancel }: DataSourceFormProps) {
    const [isLoading, setIsLoading] = useState(false);

    // Feature flag: Hide "LOCAL" if not enabled.
    const useLocalEmbedding = process.env.NEXT_PUBLIC_USE_LOCAL_EMBEDDING === "true";

    const [type, setType] = useState(useLocalEmbedding ? "LOCAL" : "WEB");
    const [name, setName] = useState("");

    // Dynamic fields
    const [path, setPath] = useState("");
    const [url, setUrl] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const config = type === "LOCAL" ? { path } : { url };

        try {
            await createSource({
                env_id: envId,
                name,
                type,
                config
            });
            onSuccess();
        } catch (err) {
            console.error("Failed to create source:", err);
            // Ideally use your Toast system here instead of alert
            alert("Failed to create source");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">
                    Source Type
                </label>
                <div className={`grid ${useLocalEmbedding ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
                    {useLocalEmbedding && (
                        <button
                            type="button"
                            onClick={() => setType("LOCAL")}
                            className={`
                                relative group flex flex-col items-start gap-3 p-5 rounded-xl border text-left transition-all duration-300
                                ${type === "LOCAL"
                                    ? "bg-amber-500/10 border-amber-500/50 shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]"
                                    : "bg-slate-900/50 border-white/5 hover:border-white/10 hover:bg-slate-800/50"
                                }
                            `}
                        >
                            <div className={`p-2 rounded-lg ${type === 'LOCAL' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                                <Folder className="w-5 h-5" />
                            </div>
                            <div>
                                <span className={`block text-sm font-semibold ${type === 'LOCAL' ? 'text-amber-100' : 'text-slate-200'}`}>
                                    Local Directory
                                </span>
                                <span className="text-xs text-slate-500 mt-0.5 block">
                                    Index files from a host folder
                                </span>
                            </div>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setType("WEB")}
                        className={`
                            relative group flex flex-col items-start gap-3 p-5 rounded-xl border text-left transition-all duration-300
                            ${type === "WEB"
                                ? "bg-blue-500/10 border-blue-500/50 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]"
                                : "bg-slate-900/50 border-white/5 hover:border-white/10 hover:bg-slate-800/50"
                            }
                        `}
                    >
                        <div className={`p-2 rounded-lg ${type === 'WEB' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                            <LinkIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <span className={`block text-sm font-semibold ${type === 'WEB' ? 'text-blue-100' : 'text-slate-200'}`}>
                                Web Resource
                            </span>
                            <span className="text-xs text-slate-500 mt-0.5 block">
                                Scrape URL or connect via API
                            </span>
                        </div>
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-3">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">
                        Name
                    </label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="
                            w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3.5
                            text-sm text-white placeholder:text-slate-500
                            focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20
                            transition-all duration-200
                        "
                        placeholder="e.g. Project Documentation"
                    />
                </div>

                {type === "LOCAL" && useLocalEmbedding && (
                    <div className="space-y-3">
                        <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider ml-1">
                            Directory Path
                        </label>
                        <div className="
                            flex items-center w-full bg-slate-900 border border-amber-500/30 rounded-xl px-4 py-3.5
                            focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/20
                            transition-all duration-200
                        ">
                            <span className="text-sm font-mono text-slate-400 select-none mr-1 border-r border-slate-700 pr-3">DATA_SOURCES_DIR/</span>
                            <input
                                type="text"
                                required
                                value={path}
                                onChange={(e) => setPath(e.target.value)}
                                className="
                                    flex-1 bg-transparent border-none p-0 ml-2
                                    text-sm font-mono text-amber-300 placeholder:text-slate-500
                                    focus:ring-0 focus:outline-none
                                "
                                placeholder="my-docs"
                            />
                        </div>
                        <p className="text-[11px] text-slate-500 ml-1">
                            Relative to the configured data sources volume on the host.
                        </p>
                    </div>
                )}

                {type === "WEB" && (
                    <div className="space-y-3">
                        <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">
                            Target URL
                        </label>
                        <div className="relative">
                            <div className="absolute left-4 top-4 text-slate-400 pointer-events-none">
                                <LinkIcon className="w-4 h-4" />
                            </div>
                            <input
                                type="url"
                                required
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="
                                    w-full bg-slate-900 border border-slate-700 rounded-xl pl-11 pr-4 py-3.5
                                    text-sm font-mono text-cyan-200 placeholder:text-slate-500
                                    focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20
                                    transition-all duration-200
                                "
                                placeholder="https://example.com/api/docs"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-4 pt-10 border-t border-slate-700/50 mt-12">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isLoading}
                    className="
                        px-5 py-3 text-sm font-medium text-slate-400 
                        hover:text-white hover:bg-slate-800 
                        rounded-xl border border-transparent hover:border-slate-700
                        transition-all duration-200
                    "
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="
                        flex items-center gap-2.5 px-8 py-3
                        bg-gradient-to-r from-cyan-500 to-blue-500
                        text-white text-sm font-bold rounded-xl 
                        shadow-lg shadow-cyan-500/25
                        hover:from-cyan-400 hover:to-blue-400
                        hover:shadow-xl hover:shadow-cyan-500/30
                        hover:scale-[1.02]
                        active:scale-[0.98]
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                        transition-all duration-200
                    "
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Source
                </button>
            </div>
        </form>
    );
}
