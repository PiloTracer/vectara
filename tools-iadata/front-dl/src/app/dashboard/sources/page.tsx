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
            <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "60vh",
                color: "rgba(255,255,255,0.4)",
            }}>
                <p>Select an environment to view resources.</p>
            </div>
        );
    }

    const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 20px",
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 500,
        border: "none",
        cursor: "pointer",
        transition: "all 0.2s ease",
        background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
        color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
        backdropFilter: isActive ? "blur(8px)" : "none",
    });

    return (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
            {/* Header */}
            <header style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 32,
                paddingBottom: 24,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
                <h1 style={{
                    fontSize: "2rem",
                    fontWeight: 300,
                    color: "#fff",
                    margin: 0,
                    letterSpacing: "-0.02em",
                }}>
                    Resources
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
                    <span>Environment:</span>
                    <span style={{
                        padding: "4px 12px",
                        borderRadius: 999,
                        background: "rgba(59, 130, 246, 0.15)",
                        border: "1px solid rgba(59, 130, 246, 0.3)",
                        color: "#93c5fd",
                        fontWeight: 500,
                    }}>
                        {activeEnvironment?.name}
                    </span>
                </div>
            </header>

            {/* Controls Row */}
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 32,
                flexWrap: "wrap",
                gap: 16,
            }}>
                {/* Tab Switcher */}
                <div style={{
                    display: "flex",
                    gap: 4,
                    padding: 4,
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.1)",
                }}>
                    <button onClick={() => setTab("SOURCES")} style={tabButtonStyle(tab === "SOURCES")}>
                        <Database style={{ width: 16, height: 16, color: tab === "SOURCES" ? "#22d3ee" : "inherit" }} />
                        Data Sources
                    </button>
                    <button onClick={() => setTab("MCP")} style={tabButtonStyle(tab === "MCP")}>
                        <Server style={{ width: 16, height: 16, color: tab === "MCP" ? "#a78bfa" : "inherit" }} />
                        MCP Servers
                    </button>
                </div>

                {/* Add Button */}
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 20px",
                            background: "#fff",
                            color: "#000",
                            border: "none",
                            borderRadius: 12,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            boxShadow: "0 4px 20px rgba(255,255,255,0.15)",
                            transition: "all 0.2s ease",
                        }}
                    >
                        <Plus style={{ width: 16, height: 16 }} />
                        Add {tab === "SOURCES" ? "Source" : "Server"}
                    </button>
                )}
            </div>

            {/* Main Content */}
            <div style={{ minHeight: 400 }}>
                {/* Loading */}
                {isLoading && !isCreating && sources.length === 0 && mcps.length === 0 ? (
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "80px 0",
                    }}>
                        <Loader2 style={{ width: 40, height: 40, color: "#22d3ee", animation: "spin 1s linear infinite" }} />
                        <p style={{ color: "rgba(255,255,255,0.3)", marginTop: 16 }}>Loading resources...</p>
                    </div>
                ) : (
                    <>
                        {/* Create Form */}
                        {isCreating && (
                            <div style={{
                                background: "linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)",
                                backdropFilter: "blur(16px)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 24,
                                padding: 32,
                                marginBottom: 32,
                                position: "relative",
                            }}>
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: 24,
                                    paddingBottom: 16,
                                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                                }}>
                                    <div>
                                        <h3 style={{ fontSize: "1.25rem", fontWeight: 500, color: "#fff", margin: 0 }}>
                                            Add New {tab === "SOURCES" ? "Data Source" : "MCP Server"}
                                        </h3>
                                        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 4 }}>
                                            Configure your {tab === "SOURCES" ? "data source" : "server"} connection details.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIsCreating(false)}
                                        style={{
                                            padding: 8,
                                            background: "rgba(255,255,255,0.05)",
                                            border: "none",
                                            borderRadius: 8,
                                            cursor: "pointer",
                                            color: "rgba(255,255,255,0.4)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <X style={{ width: 20, height: 20 }} />
                                    </button>
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
