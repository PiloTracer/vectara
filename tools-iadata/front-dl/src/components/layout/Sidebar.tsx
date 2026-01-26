"use client";

import EnvironmentSelector from "./EnvironmentSelector";
import SidebarItem from "./SidebarItem";

export default function Sidebar() {
    return (
        <aside
            style={{
                width: "280px",
                height: "100vh",
                backgroundColor: "#0f172a", // Dark blue-gray
                borderRight: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                flexDirection: "column",
                padding: "24px 0",
                position: "fixed",
                top: 0,
                left: 0,
                zIndex: 50,
            }}
        >
            <div style={{ padding: "0 24px 24px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "32px", height: "32px", background: "linear-gradient(135deg, #38bdf8, #818cf8)", borderRadius: "8px" }}></div>
                <h1 style={{ fontSize: "1.2rem", fontWeight: "700", background: "linear-gradient(to right, #38bdf8, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
                    Tools IADATA
                </h1>
            </div>

            <EnvironmentSelector />

            <div style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
                {/* Core Management */}
                <div style={{ marginBottom: "24px" }}>
                    <h3 style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", padding: "0 12px 8px", margin: 0 }}>Management</h3>
                    <SidebarItem href="/dashboard/environments" label="Environments" icon="⚙️" />
                    <SidebarItem href="/dashboard/sources" label="Data Sources" icon="📂" />
                    <SidebarItem href="/dashboard/models" label="Models" icon="🧠" />
                    <SidebarItem href="/dashboard/agents" label="Agents" icon="🤖" />
                </div>

                {/* Workspace */}
                <div style={{ marginBottom: "24px" }}>
                    <h3 style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", padding: "0 12px 8px", margin: 0 }}>Workspace</h3>
                    <SidebarItem href="/dashboard" label="Chat Interface" icon="💬" />
                    <SidebarItem href="/dashboard/history" label="Session History" icon="📜" />
                    <SidebarItem href="/dashboard/knowledge" label="Knowledge Base" icon="📚" />
                </div>
            </div>

            {/* System Footer */}
            <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <SidebarItem href="/dashboard/settings" label="Settings" icon="🔧" />
                <SidebarItem href="/dashboard/docs" label="Documentation" icon="📄" />
            </div>
        </aside>
    );
}
