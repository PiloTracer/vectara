"use client";

import React, { useState } from "react";
import { DataSource, deleteSource } from "../../actions/resources";
import { Trash2, Loader2, Database, Folder, Globe } from "lucide-react";

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

    const getIcon = (type: string) => {
        switch (type) {
            case "LOCAL": return <Folder className="w-5 h-5 text-blue-400" />;
            case "WEB": return <Globe className="w-5 h-5 text-green-400" />;
            default: return <Database className="w-5 h-5 text-gray-400" />;
        }
    };

    if (sources.length === 0) {
        return (
            <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                <Database className="w-12 h-12 mx-auto text-white/20 mb-3" />
                <h3 className="text-lg font-medium text-white/80">No Data Sources</h3>
                <p className="text-white/40 text-sm">Add a source to start indexing data.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4">
            {sources.map((source) => (
                <div key={source.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between group hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center border border-white/5">
                            {getIcon(source.type)}
                        </div>
                        <div>
                            <h4 className="font-medium text-white/90">{source.name}</h4>
                            <div className="text-xs text-white/50 flex items-center gap-2 mt-0.5">
                                <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] tracking-wide font-mono">{source.type}</span>
                                <span className="truncate max-w-[300px]" title={JSON.stringify(source.config)}>
                                    {source.type === "LOCAL" ? source.config.path : source.config.url}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => handleDelete(source.id)}
                        disabled={!!deletingId}
                        className="p-2 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                        {deletingId === source.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    </button>
                </div>
            ))}
        </div>
    );
}
