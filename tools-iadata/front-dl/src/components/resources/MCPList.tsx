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
    const [hoveredId, setHoveredId] = useState<string | null>(null);

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

    if (mcps.length === 0) {
        return (
            <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "80px 32px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 24,
                border: "2px dashed rgba(255,255,255,0.1)",
            }}>
                <div style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.1))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 24,
                    border: "1px solid rgba(255,255,255,0.1)",
                }}>
                    <Server style={{ width: 40, height: 40, color: "rgba(255,255,255,0.2)" }} />
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 500, color: "#fff", marginBottom: 8 }}>
                    No MCP Servers Configured
                </h3>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.875rem", textAlign: "center", maxWidth: 400, lineHeight: 1.6 }}>
                    Connect an MCP-compatible server via STDIO or SSE to extend your agents' capabilities.
                </p>
            </div>
        );
    }

    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 24,
        }}>
            {mcps.map((mcp) => {
                const isSTDIO = mcp.transport_type === "STDIO";
                const isHovered = hoveredId === mcp.id;
                const accentColor = isSTDIO ? "168, 85, 247" : "99, 102, 241"; // purple vs indigo

                return (
                    <div
                        key={mcp.id}
                        style={{
                            background: isHovered
                                ? `linear-gradient(180deg, rgba(${accentColor}, 0.08) 0%, rgba(15, 23, 42, 0.95) 100%)`
                                : "linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)",
                            backdropFilter: "blur(12px)",
                            border: isHovered ? `1px solid rgba(${accentColor}, 0.3)` : "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: 20,
                            padding: 24,
                            display: "flex",
                            flexDirection: "column",
                            gap: 16,
                            transition: "all 0.3s ease",
                            transform: isHovered ? "translateY(-4px)" : "none",
                            boxShadow: isHovered ? `0 20px 40px -12px rgba(${accentColor}, 0.15)` : "none",
                        }}
                        onMouseEnter={() => setHoveredId(mcp.id)}
                        onMouseLeave={() => setHoveredId(null)}
                    >
                        {/* Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 14,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: `rgba(${accentColor}, 0.15)`,
                                border: `1px solid rgba(${accentColor}, 0.3)`,
                            }}>
                                {isSTDIO
                                    ? <Terminal style={{ width: 24, height: 24, color: "#d8b4fe" }} />
                                    : <Globe style={{ width: 24, height: 24, color: "#a5b4fc" }} />
                                }
                            </div>
                            <span style={{
                                padding: "4px 10px",
                                borderRadius: 999,
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                background: `rgba(${accentColor}, 0.15)`,
                                border: `1px solid rgba(${accentColor}, 0.3)`,
                                color: isSTDIO ? "#d8b4fe" : "#a5b4fc",
                            }}>
                                {mcp.transport_type}
                            </span>
                        </div>

                        {/* Title */}
                        <h4 style={{
                            fontSize: "1.25rem",
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.9)",
                            margin: 0,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }} title={mcp.name}>
                            {mcp.name}
                        </h4>

                        {/* Command/URL */}
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12,
                            color: "rgba(255,255,255,0.4)",
                            fontFamily: "ui-monospace, monospace",
                            background: "rgba(0,0,0,0.3)",
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.05)",
                        }}>
                            <span style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                            }}>
                                {isSTDIO ? mcp.command : mcp.url}
                            </span>
                        </div>

                        {/* Footer */}
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            paddingTop: 16,
                            marginTop: "auto",
                            borderTop: "1px solid rgba(255,255,255,0.05)",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: mcp.enabled ? "#22c55e" : "#ef4444",
                                    boxShadow: mcp.enabled ? "0 0 8px rgba(34, 197, 94, 0.6)" : "0 0 8px rgba(239, 68, 68, 0.6)",
                                }} />
                                <span style={{
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                    color: "rgba(255,255,255,0.4)",
                                    fontWeight: 600,
                                }}>
                                    {mcp.enabled ? "ONLINE" : "OFFLINE"}
                                </span>
                            </div>

                            <button
                                onClick={() => handleDelete(mcp.id)}
                                disabled={!!deletingId}
                                style={{
                                    padding: 10,
                                    background: "transparent",
                                    border: "none",
                                    borderRadius: 10,
                                    cursor: deletingId ? "not-allowed" : "pointer",
                                    color: "rgba(255,255,255,0.2)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                                title="Delete Server"
                            >
                                {deletingId === mcp.id
                                    ? <Loader2 style={{ width: 16, height: 16 }} />
                                    : <Trash2 style={{ width: 16, height: 16 }} />
                                }
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
