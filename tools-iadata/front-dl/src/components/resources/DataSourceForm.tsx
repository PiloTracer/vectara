"use client";

import React, { useState, useEffect } from "react";
import { createSource } from "../../actions/resources";
import { Loader2, Folder, Link as LinkIcon, Save } from "lucide-react";

interface DataSourceFormProps {
    envId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export function DataSourceForm({ envId, onSuccess, onCancel }: DataSourceFormProps) {
    const [isLoading, setIsLoading] = useState(false);

    // Feature flag: Hide "LOCAL" if not enabled. Default to true if not set (for dev safety), or false? 
    // User requested: "MUST BE ONLY AVAILABLE IF USE_LOCAL_EMBEDDING = TRUE"
    // We pass this as NEXT_PUBLIC_USE_LOCAL_EMBEDDING.
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
            alert("Failed to create source");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
                <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wide">Source Type</label>
                <div className={`grid ${useLocalEmbedding ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
                    {useLocalEmbedding && (
                        <button
                            type="button"
                            onClick={() => setType("LOCAL")}
                            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200 ${type === "LOCAL" ? "bg-amber-500/10 border-amber-500/50 text-amber-200 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]" : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:border-white/10"}`}
                        >
                            <Folder className="w-6 h-6 mb-1" />
                            <span className="text-sm font-medium">Local Directory</span>
                            <span className="text-[10px] opacity-60">Host Folder</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setType("WEB")}
                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200 ${type === "WEB" ? "bg-blue-500/10 border-blue-500/50 text-blue-200 shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)]" : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:border-white/10"}`}
                    >
                        <LinkIcon className="w-6 h-6 mb-1" />
                        <span className="text-sm font-medium">Web Resource</span>
                        <span className="text-[10px] opacity-60">URL / API</span>
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wide">Name</label>
                <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-white/20"
                    placeholder="e.g. Project Documentation"
                />
            </div>

            {type === "LOCAL" && useLocalEmbedding && (
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-4">
                    <label className="block text-xs font-semibold text-amber-200/80 mb-1.5 uppercase tracking-wide">Directory Name</label>
                    <div className="flex items-center gap-2 text-white/40 text-sm font-mono mb-2">
                        <span>DATA_SOURCES_DIR/</span>
                        <input
                            type="text"
                            required
                            value={path}
                            onChange={(e) => setPath(e.target.value)}
                            className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                            placeholder="my-docs"
                        />
                    </div>
                    <p className="text-[10px] text-amber-200/40">
                        Enter the name of the subdirectory inside your configured Data Sources folder.
                    </p>
                </div>
            )}

            {type === "WEB" && (
                <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wide">URL</label>
                    <div className="relative">
                        <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-white/20" />
                        <input
                            type="url"
                            required
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all font-mono placeholder:text-white/20"
                            placeholder="https://example.com/api/docs"
                        />
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 shadow-lg shadow-white/10"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Source
                </button>
            </div>
        </form>
    );
}
