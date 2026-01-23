"use client";

import React, { useState } from "react";
import { MCPServer, deleteMCP } from "../../actions/resources";
import { Trash2, Loader2, Server, Terminal, Globe } from "lucide-react";

interface MCPListProps {
    mcps: MCPServer[];
    onRefresh: () => void;
}

export function MCPList({ mcps, onRefresh }: MCPListProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this MCP server?")) return;
        setDeletingId(id);
        try {
            await deleteMCP(id);
            onRefresh();
        } catch (err) {
            console.error("Failed to delete MCP:", err);
            alert("Failed to delete MCP");
        } finally {
            setDeletingId(null);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case "STDIO": return <Terminal className="w-5 h-5 text-purple-400" />;
            case "SSE": return <Globe className="w-5 h-5 text-indigo-400" />;
            default: return <Server className="w-5 h-5 text-gray-400" />;
        }
    };

    if (mcps.length === 0) {
        return (
            <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                <Server className="w-12 h-12 mx-auto text-white/20 mb-3" />
                <h3 className="text-lg font-medium text-white/80">No MCP Servers</h3>
                <p className="text-white/40 text-sm">Add an MCP server to extend capabilities.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mcps.map((mcp) => (
                <div key={mcp.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between group hover:bg-white/10 transition-colors h-full">
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center border border-white/5">
                                    {getIcon(mcp.transport_type)}
                                </div>
                                <h4 className="font-medium text-white/90">{mcp.name}</h4>
                            </div>
                            <span className={`w-2 h-2 rounded-full ${mcp.enabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-500"}`} />
                        </div>

                        <div className="bg-black/30 rounded-lg p-2 font-mono text-[10px] text-white/60 truncate border border-white/5">
                            {mcp.transport_type === "STDIO" ? mcp.command : mcp.url}
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <span className="text-xs text-white/40 font-mono tracking-wide">{mcp.transport_type}</span>
                        <button
                            onClick={() => handleDelete(mcp.id)}
                            disabled={!!deletingId}
                            className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        >
                            {deletingId === mcp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
