"use client";

import React, { useEffect, useState } from "react";
import { useEnvironment } from "../../../context/EnvironmentContext";
import { getSources, getMCPs, DataSource, MCPServer } from "../../../actions/resources";
import { DataSourceList } from "../../../components/resources/DataSourceList";
import { DataSourceForm } from "../../../components/resources/DataSourceForm";
import { MCPList } from "../../../components/resources/MCPList";
import { MCPForm } from "../../../components/resources/MCPForm";
import { Loader2, Plus, Database, Server } from "lucide-react";

export default function ResourcesPage() {
    const { activeEnvironmentId, activeEnvironment } = useEnvironment();

    const [tab, setTab] = useState<"SOURCES" | "MCP">("SOURCES");
    const [isCreating, setIsCreating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Data
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
        // Reset creating state when switching tabs or envs
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
        <div className="max-w-5xl mx-auto space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-light text-white mb-2">Resources</h1>
                    <p className="text-white/40 text-sm">Manage data sources and intelligence servers for <strong className="text-white/70 font-medium">{activeEnvironment?.name}</strong>.</p>
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl w-fit border border-white/10">
                <button
                    onClick={() => setTab("SOURCES")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "SOURCES" ? "bg-white text-black shadow-lg" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                >
                    <Database className="w-4 h-4" />
                    Data Sources
                </button>
                <button
                    onClick={() => setTab("MCP")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "MCP" ? "bg-white text-black shadow-lg" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                >
                    <Server className="w-4 h-4" />
                    MCP Servers
                </button>
            </div>

            {/* Main Content Area */}
            <div className="min-h-[400px]">
                {/* Header Actions */}
                {!isCreating && (
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={() => setIsCreating(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                        >
                            <Plus className="w-4 h-4" />
                            Add {tab === "SOURCES" ? "Source" : "MCP Server"}
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && !isCreating && sources.length === 0 && mcps.length === 0 ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Creation Forms */}
                        {isCreating && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="mb-6 pb-4 border-b border-white/5">
                                    <h3 className="text-lg font-medium text-white">Add New {tab === "SOURCES" ? "Data Source" : "MCP Server"}</h3>
                                </div>
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
                        )}

                        {/* Lists */}
                        {!isCreating && (
                            tab === "SOURCES" ? (
                                <DataSourceList sources={sources} onRefresh={fetchData} />
                            ) : (
                                <MCPList mcps={mcps} onRefresh={fetchData} />
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
