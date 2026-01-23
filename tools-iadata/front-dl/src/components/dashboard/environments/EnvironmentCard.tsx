"use client";

import React from "react";
import { useEnvironment } from "../../../context/EnvironmentContext";
import { Environment } from "../../../actions/environments";

interface EnvironmentCardProps {
    env: Environment;
}

export default function EnvironmentCard({ env }: EnvironmentCardProps) {
    const { activeEnvironmentId, setActiveEnvironment } = useEnvironment();
    const isActive = activeEnvironmentId === env.id;

    return (
        <div
            style={{
                backgroundColor: isActive ? "rgba(56, 189, 248, 0.1)" : "rgba(30, 41, 59, 0.7)",
                backdropFilter: "blur(12px)",
                border: isActive ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "16px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                transition: "all 0.2s ease-in-out",
                cursor: "pointer",
                position: "relative",
                boxShadow: isActive ? "0 0 20px rgba(56, 189, 248, 0.2)" : "none",
            }}
            onClick={() => setActiveEnvironment(env)}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#f8fafc", margin: 0 }}>
                        {env.name}
                    </h3>
                    <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginTop: "8px", lineHeight: "1.5" }}>
                        {env.description || "No description provided."}
                    </p>
                </div>
                {isActive && (
                    <span style={{
                        backgroundColor: "#0ea5e9",
                        color: "white",
                        fontSize: "0.75rem",
                        padding: "4px 8px",
                        borderRadius: "999px",
                        fontWeight: "600"
                    }}>
                        Active
                    </span>
                )}
            </div>

            <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748b" }}>
                <span>{env.settings?.default_model || "Default Model"}</span>
                <span>{new Date(env.created_at).toLocaleDateString()}</span>
            </div>
        </div>
    );
}
