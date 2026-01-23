"use client";

import { useEnvironment } from "../../context/EnvironmentContext";

export default function EnvironmentSelector() {
    const { activeEnvironment } = useEnvironment();

    return (
        <div style={{ padding: "0 16px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: "16px" }}>
            <label style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>
                Active Environment
            </label>
            <div
                style={{
                    padding: "10px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: activeEnvironment ? "#fff" : "#94a3b8",
                    fontSize: "0.9rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer"
                }}
            >
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {activeEnvironment ? activeEnvironment.name : "Select Environment"}
                </span>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>▼</span>
            </div>
        </div>
    );
}
