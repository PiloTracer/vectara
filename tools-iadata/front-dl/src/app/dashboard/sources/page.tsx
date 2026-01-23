"use client";

import React, { useEffect, useState } from "react";
import { useEnvironment } from "../../../context/EnvironmentContext";
import { getSources, getMCPs, DataSource, MCPServer } from "../../../actions/resources";
import { DataSourceList } from "../../../components/resources/DataSourceList";
import { DataSourceForm } from "../../../components/resources/DataSourceForm";
import { MCPList } from "../../../components/resources/MCPList";
import { MCPForm } from "../../../components/resources/MCPForm";
import { Loader2, Plus, Database, Server, X } from "lucide-react";

export default function ResourcesPage() {
    const { activeEnvironmentId, activeEnvironment } = useEnvironment();

    const [tab, setTab] = useState<"SOURCES" | "MCP">("SOURCES");
    const [isCreating, setIsCreating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [sources, setSources] = useState<DataSource[]>([]);
    const [mcps, setMcps] = useState<MCPServer[]>([]);

    const fetchData = async () => {
        if (!activeEnvironmentId) return;
        setIsLoading(true);
        try {
            if (tab === "SOURCES") {
                const data = await getSources(activeEnvironmentId);
                setSources(data);
            } else {
                const data = await getMCPs(activeEnvironmentId);
                setMcps(data);
            }
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        setIsCreating(false);
    }, [activeEnvironmentId, tab]);

    if (!activeEnvironmentId) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-white/40">
                <p>Select an environment to view resources.</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-8 py-8 animate-fade-in">
            {/* Header */}
            <header className="flex flex-col gap-3 mb-10 pb-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-light text-white tracking-tight mb-2">
                            Resources
                        </h1>
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                            <span>Environment scope:</span>
                            <span className="
                                px-3 py-1 rounded-full 
                                bg-blue-500/10 border border-blue-500/20 
                                text-blue-300 font-medium text-xs tracking-wide
                            ">
                                {activeEnvironment?.name}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Controls Row */}
            <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
                {/* Tab Switcher */}
                <div className="flex bg-slate-900/50 p-1.5 rounded-xl border border-white/5">
                    <button
                        onClick={() => setTab("SOURCES")}
                        className={`
                            flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                            ${tab === "SOURCES"
                                ? "bg-white/10 text-white shadow-lg shadow-black/20"
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                            }
                        `}
                    >
                        <Database className={`w-4 h-4 ${tab === "SOURCES" ? "text-cyan-400" : ""}`} />
                        Data Sources
                    </button>
                    <button
                        onClick={() => setTab("MCP")}
                        className={`
                            flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                            ${tab === "MCP"
                                ? "bg-white/10 text-white shadow-lg shadow-black/20"
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                            }
                        `}
                    >
                        <Server className={`w-4 h-4 ${tab === "MCP" ? "text-violet-400" : ""}`} />
                        MCP Servers
                    </button>
                </div>

                {/* Add Button */}
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="
                            flex items-center gap-2 px-6 py-3 
                            bg-white text-slate-900 
                            border border-transparent
                            rounded-xl text-sm font-bold 
                            hover:bg-slate-200 hover:scale-105 hover:shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]
                            active:scale-95
                            transition-all duration-200
                        "
                    >
                        <Plus className="w-5 h-5" />
                        Add {tab === "SOURCES" ? "Source" : "Server"}
                    </button>
                )}
            </div>

            {/* Main Content */}
            <div className="min-h-[400px]">
                {/* Loading */}
                {isLoading && !isCreating && sources.length === 0 && mcps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
                        <p className="text-white/30">Loading resources...</p>
                    </div>
                ) : (
                    <>
                        {/* Create Form */}
                        {isCreating && (
                            <div className="
                                relative mb-10 overflow-hidden
                                bg-[#0F1218] border border-white/10 rounded-2xl shadow-2xl shadow-black/50
                            ">
                                {/* Decor */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[80px] rounded-full pointer-events-none" />

                                <div className="relative z-10 p-8">
                                    <div className="flex justify-between items-start mb-8 pb-6 border-b border-white/5">
                                        <div>
                                            <h3 className="text-2xl font-light text-white mb-2">
                                                Add New {tab === "SOURCES" ? "Data Source" : "MCP Server"}
                                            </h3>
                                            <p className="text-slate-400 text-sm">
                                                Configure your {tab === "SOURCES" ? "data source" : "server"} connection details.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setIsCreating(false)}
                                            className="
                                                p-2 rounded-lg bg-white/5 text-slate-400 
                                                hover:bg-white/10 hover:text-white 
                                                transition-colors
                                            "
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="max-w-2xl">
                                        {tab === "SOURCES" ? (
                                            <DataSourceForm
                                                envId={activeEnvironmentId}
                                                onSuccess={() => { setIsCreating(false); fetchData(); }}
                                                onCancel={() => setIsCreating(false)}
                                            />
                                        ) : (
                                            <MCPForm
                                                envId={activeEnvironmentId}
                                                onSuccess={() => { setIsCreating(false); fetchData(); }}
                                                onCancel={() => setIsCreating(false)}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Lists */}
                        {!isCreating && (
                            <div className="animate-slide-up">
                                {tab === "SOURCES" ? (
                                    <DataSourceList sources={sources} onRefresh={fetchData} />
                                ) : (
                                    <MCPList mcps={mcps} onRefresh={fetchData} />
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
