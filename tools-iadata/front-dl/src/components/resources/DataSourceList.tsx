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
    const [hoveredId, setHoveredId] = useState<string | null>(null);

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
                    <Database style={{ width: 40, height: 40, color: "rgba(255,255,255,0.2)" }} />
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 500, color: "#fff", marginBottom: 8 }}>
                    No Data Sources Configured
                </h3>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.875rem", textAlign: "center", maxWidth: 400, lineHeight: 1.6 }}>
                    Add a local directory or web resource to start building your knowledge base.
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
            {sources.map((source) => {
                const isLocal = source.type === "LOCAL";
                const isHovered = hoveredId === source.id;
                const accentColor = isLocal ? "245, 158, 11" : "59, 130, 246";

                return (
                    <div
                        key={source.id}
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
                        onMouseEnter={() => setHoveredId(source.id)}
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
                                {isLocal
                                    ? <Folder style={{ width: 24, height: 24, color: "#fcd34d" }} />
                                    : <Globe style={{ width: 24, height: 24, color: "#93c5fd" }} />
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
                                color: isLocal ? "#fcd34d" : "#93c5fd",
                            }}>
                                {source.type}
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
                        }} title={source.name}>
                            {source.name}
                        </h4>

                        {/* Path */}
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
                            {!isLocal && <ExternalLink style={{ width: 14, height: 14, flexShrink: 0, opacity: 0.5 }} />}
                            <span style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                            }}>
                                {isLocal ? source.config?.path : source.config?.url}
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
                                    background: "#22c55e",
                                    boxShadow: "0 0 8px rgba(34, 197, 94, 0.6)",
                                }} />
                                <span style={{
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                    color: "rgba(255,255,255,0.4)",
                                    fontWeight: 600,
                                }}>
                                    READY
                                </span>
                            </div>

                            <button
                                onClick={() => handleDelete(source.id)}
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
                                title="Delete Source"
                            >
                                {deletingId === source.id
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
