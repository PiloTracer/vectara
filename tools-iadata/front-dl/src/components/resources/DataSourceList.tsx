"use client";

import React, { useState } from "react";
import { DataSource, deleteSource } from "../../actions/resources";
import { Trash2, Loader2, Database, Folder, Globe, ExternalLink } from "lucide-react";

interface DataSourceListProps {
    sources: DataSource[];
    onRefresh: () => void;
}

export function DataSourceList({ sources, onRefresh }: DataSourceListProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this source?")) return;
        setDeletingId(id);
        try {
            await deleteSource(id);
            onRefresh();
        } catch (err) {
            console.error("Failed to delete source:", err);
            alert("Failed to delete source");
        } finally {
            setDeletingId(null);
        }
    };

    if (sources.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-8 bg-white/5 rounded-3xl border-2 border-dashed border-white/10 text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center mb-6 border border-white/10">
                    <Database className="w-10 h-10 text-white/20" />
                </div>
                <h3 className="text-xl font-medium text-white mb-2">
                    No Data Sources Configured
                </h3>
                <p className="text-white/40 text-sm max-w-sm leading-relaxed">
                    Add a local directory or web resource to start building your knowledge base.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sources.map((source) => {
                const isLocal = source.type === "LOCAL";
                const accentColor = isLocal ? "amber" : "blue";

                // Construct dynamic classes based on type
                // heavy use of template literals for color interpolation
                const iconBg = isLocal ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-blue-500/15 border-blue-500/30 text-blue-400";
                const badgeBg = isLocal ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-blue-500/15 border-blue-500/30 text-blue-400";

                return (
                    <div
                        key={source.id}
                        className="
                            group relative 
                            bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 
                            hover:border-slate-600 hover:bg-slate-800/80
                            hover:shadow-xl hover:shadow-black/30 
                            transition-all duration-300
                            flex flex-col gap-4
                        "
                    >
                        {/* Background Sheen Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />

                        {/* Card Content (Relative z-10 to sit above sheen) */}
                        <div className="relative z-10 flex flex-col h-full gap-4">

                            {/* Header */}
                            <div className="flex justify-between items-start">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${iconBg}`}>
                                    {isLocal
                                        ? <Folder className="w-6 h-6" />
                                        : <Globe className="w-6 h-6" />
                                    }
                                </div>
                                <span className={`
                                    px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border
                                    ${badgeBg}
                                `}>
                                    {source.type}
                                </span>
                            </div>

                            {/* Title */}
                            <div>
                                <h4 className="text-lg font-semibold text-slate-200 truncate" title={source.name}>
                                    {source.name}
                                </h4>
                            </div>

                            {/* Path */}
                            <div className="
                                flex items-center gap-2 
                                text-xs font-mono text-slate-300
                                bg-slate-950 border border-slate-700 rounded-xl px-3 py-3
                                overflow-hidden
                            ">
                                {!isLocal && <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />}
                                <span className="truncate">
                                    {isLocal ? source.config?.path : source.config?.url}
                                </span>
                            </div>

                            {/* Footer */}
                            <div className="mt-auto pt-4 border-t border-slate-700/50 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        Active
                                    </span>
                                </div>

                                <button
                                    onClick={() => handleDelete(source.id)}
                                    disabled={!!deletingId}
                                    className="
                                        p-2 rounded-lg 
                                        text-slate-600 hover:text-red-400 hover:bg-red-500/10 
                                        transition-colors duration-200
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                    "
                                    title="Delete Source"
                                >
                                    {deletingId === source.id
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Trash2 className="w-4 h-4" />
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
