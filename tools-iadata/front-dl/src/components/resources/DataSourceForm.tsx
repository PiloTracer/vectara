"use client";

import React, { useState } from "react";
import { createSource } from "../../actions/resources";
import { Loader2, Plus, FolderOpen, Link as LinkIcon, Save } from "lucide-react";

interface DataSourceFormProps {
    envId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export function DataSourceForm({ envId, onSuccess, onCancel }: DataSourceFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [type, setType] = useState("LOCAL");
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
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">Source Type</label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setType("LOCAL")}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${type === "LOCAL" ? "bg-amber-500/20 border-amber-500/50 text-amber-200" : "bg-white/5 border-transparent text-white/60 hover:bg-white/10"}`}
                    >
                        <FolderOpen className="w-4 h-4" />
                        <span className="text-sm font-medium">Local File System</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setType("WEB")}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${type === "WEB" ? "bg-blue-500/20 border-blue-500/50 text-blue-200" : "bg-white/5 border-transparent text-white/60 hover:bg-white/10"}`}
                    >
                        <LinkIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">Web Resource</span>
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">Name</label>
                <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                    placeholder="e.g. Project Docs"
                />
            </div>

            {type === "LOCAL" && (
                <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">Absolute Path</label>
                    <input
                        type="text"
                        required
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors font-mono placeholder:text-white/20"
                        placeholder="/mnt/data/..."
                    />
                </div>
            )}

            {type === "WEB" && (
                <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">URL</label>
                    <input
                        type="url"
                        required
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors font-mono placeholder:text-white/20"
                        placeholder="https://example.com/api/docs"
                    />
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
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
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Source
                </button>
            </div>
        </form>
    );
}
