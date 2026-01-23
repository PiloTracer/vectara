"use client";

import React, { useEffect, useState } from "react";
import { useEnvironment } from "../../../context/EnvironmentContext";
import { getAgents, getRolePresets, createAgent, deleteAgent, updateAgent, Agent, RolePreset } from "../../../actions/agents";
import { getModels, LLMModel } from "../../../actions/models";
import { Loader2, Plus, Trash2, Bot, Edit2, Save, X } from "lucide-react";

export default function AgentsPage() {
    const { activeEnvironmentId, activeEnvironment } = useEnvironment();

    const [agents, setAgents] = useState<Agent[]>([]);
    const [rolePresets, setRolePresets] = useState<RolePreset[]>([]);
    const [models, setModels] = useState<LLMModel[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPrompt, setEditPrompt] = useState("");
    const [selectedRole, setSelectedRole] = useState<RolePreset | null>(null);
    const [formData, setFormData] = useState({ name: "", system_prompt: "", model_id: "" });

    const fetchData = async () => {
        if (!activeEnvironmentId) return;
        setIsLoading(true);
        try {
            const [agentsData, rolesData, modelsData] = await Promise.all([
                getAgents(activeEnvironmentId),
                getRolePresets(),
                getModels(activeEnvironmentId)
            ]);
            setAgents(agentsData);
            setRolePresets(rolesData);
            setModels(modelsData);
        } catch (err) {
            console.error("Failed to fetch data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [activeEnvironmentId]);

    const handleRoleSelect = (role: RolePreset) => {
        setSelectedRole(role);
        setFormData({
            name: role.id === "custom" ? "" : role.name,
            system_prompt: role.default_prompt,
            model_id: models.find((m: LLMModel) => m.is_default)?.id || "",
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRole || !activeEnvironmentId) return;
        try {
            await createAgent({
                env_id: activeEnvironmentId,
                name: formData.name || selectedRole.name,
                role: selectedRole.id,
                system_prompt: formData.system_prompt,
                model_override: formData.model_id ? { model_id: formData.model_id } : {},
            });
            setIsCreating(false);
            setSelectedRole(null);
            fetchData();
        } catch (err) {
            console.error("Failed to create agent:", err);
            alert("Failed to create agent");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this agent?")) return;
        try { await deleteAgent(id); fetchData(); } catch (err) { console.error("Failed to delete:", err); }
    };

    const handleUpdate = async (agent: Agent, updates: { system_prompt?: string }) => {
        try {
            await updateAgent(agent.id, updates);
            setEditingId(null);
            fetchData();
        } catch (err) { console.error("Failed to update:", err); }
    };

    const startEditing = (agent: Agent) => {
        setEditingId(agent.id);
        setEditPrompt(agent.system_prompt || "");
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case "assistant": return { bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.3)", text: "#93c5fd" };
            case "researcher": return { bg: "rgba(168, 85, 247, 0.15)", border: "rgba(168, 85, 247, 0.3)", text: "#d8b4fe" };
            case "coder": return { bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.3)", text: "#86efac" };
            case "writer": return { bg: "rgba(249, 115, 22, 0.15)", border: "rgba(249, 115, 22, 0.3)", text: "#fdba74" };
            case "analyst": return { bg: "rgba(236, 72, 153, 0.15)", border: "rgba(236, 72, 153, 0.3)", text: "#f9a8d4" };
            default: return { bg: "rgba(148, 163, 184, 0.15)", border: "rgba(148, 163, 184, 0.3)", text: "#cbd5e1" };
        }
    };

    const getRoleIcon = (role: string) => {
        const preset = rolePresets.find((r: RolePreset) => r.id === role);
        return preset?.icon || "🤖";
    };

    if (!activeEnvironmentId) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "rgba(255,255,255,0.4)" }}>
                <p>Select an environment to view agents.</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
            {/* Header */}
            <header style={{ marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <h1 style={{ fontSize: "2rem", fontWeight: 300, color: "#fff", margin: 0 }}>Agents</h1>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 8 }}>
                    Configure AI agents for {activeEnvironment?.name || "your environment"}
                </p>
            </header>

            {/* Controls */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
                            background: "#fff", color: "#000", border: "none", borderRadius: 12,
                            fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 20px rgba(255,255,255,0.15)",
                        }}
                    >
                        <Plus style={{ width: 16, height: 16 }} />
                        Create Agent
                    </button>
                )}
            </div>

            {/* Create Form */}
            {isCreating && (
                <div style={{
                    background: "linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: 32, marginBottom: 32,
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                        <h3 style={{ fontSize: "1.25rem", fontWeight: 500, color: "#fff", margin: 0 }}>
                            {selectedRole ? `Configure ${selectedRole.name}` : "Select Agent Role"}
                        </h3>
                        <button
                            onClick={() => { setIsCreating(false); setSelectedRole(null); }}
                            style={{ padding: 8, background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8, cursor: "pointer", color: "rgba(255,255,255,0.4)" }}
                        >
                            <X style={{ width: 20, height: 20 }} />
                        </button>
                    </div>

                    {!selectedRole ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
                            {rolePresets.map((role: RolePreset) => {
                                const colors = getRoleColor(role.id);
                                return (
                                    <button
                                        key={role.id}
                                        onClick={() => handleRoleSelect(role)}
                                        style={{
                                            padding: 20, background: colors.bg, border: `1px solid ${colors.border}`,
                                            borderRadius: 16, cursor: "pointer", textAlign: "center", transition: "all 0.2s",
                                        }}
                                    >
                                        <div style={{ fontSize: 32, marginBottom: 8 }}>{role.icon}</div>
                                        <div style={{ color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{role.name}</div>
                                        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: 0, lineHeight: 1.4 }}>{role.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            <div>
                                <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Agent Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={selectedRole.name}
                                    style={{ width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14 }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>System Prompt</label>
                                <textarea
                                    value={formData.system_prompt}
                                    onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                                    placeholder="Define the agent's behavior..."
                                    rows={6}
                                    style={{ width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
                                />
                            </div>
                            {models.length > 0 && (
                                <div>
                                    <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Model (optional)</label>
                                    <select
                                        value={formData.model_id}
                                        onChange={(e) => setFormData({ ...formData, model_id: e.target.value })}
                                        style={{ width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14 }}
                                    >
                                        <option value="">Use environment default</option>
                                        {models.map((m: LLMModel) => <option key={m.id} value={m.id}>{m.name} {m.is_default ? "(default)" : ""}</option>)}
                                    </select>
                                </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                                <button type="button" onClick={() => setSelectedRole(null)} style={{ padding: "10px 20px", background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 14 }}>Back</button>
                                <button type="submit" style={{ padding: "10px 24px", background: "#fff", color: "#000", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Create Agent</button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* Content */}
            {isLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
                    <Loader2 style={{ width: 40, height: 40, color: "#22d3ee", animation: "spin 1s linear infinite" }} />
                </div>
            ) : agents.length === 0 ? (
                <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    padding: "80px 32px", background: "rgba(255,255,255,0.03)", borderRadius: 24, border: "2px dashed rgba(255,255,255,0.1)",
                }}>
                    <Bot style={{ width: 48, height: 48, color: "rgba(255,255,255,0.2)", marginBottom: 24 }} />
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 500, color: "#fff", marginBottom: 8 }}>No Agents Configured</h3>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 400 }}>
                        Create AI agents with custom roles and system prompts.
                    </p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {agents.map((agent: Agent) => {
                        const colors = getRoleColor(agent.role);
                        const isEditing = editingId === agent.id;

                        return (
                            <div key={agent.id} style={{
                                background: "linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)",
                                border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 20, padding: 24,
                            }}>
                                {/* Header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                        <div style={{
                                            width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
                                            background: colors.bg, border: `1px solid ${colors.border}`, fontSize: 28,
                                        }}>
                                            {getRoleIcon(agent.role)}
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#fff", margin: 0 }}>{agent.name}</h4>
                                            <span style={{
                                                display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 999,
                                                background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text,
                                                fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                                            }}>
                                                {agent.role}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button
                                            onClick={() => isEditing ? setEditingId(null) : startEditing(agent)}
                                            style={{ padding: 8, background: isEditing ? "rgba(255,255,255,0.1)" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", color: "rgba(255,255,255,0.4)" }}
                                        >
                                            <Edit2 style={{ width: 16, height: 16 }} />
                                        </button>
                                        <button onClick={() => handleDelete(agent.id)} style={{ padding: 8, background: "transparent", border: "none", borderRadius: 8, cursor: "pointer", color: "rgba(255,255,255,0.2)" }}>
                                            <Trash2 style={{ width: 16, height: 16 }} />
                                        </button>
                                    </div>
                                </div>

                                {/* System Prompt */}
                                <div style={{ marginTop: 16 }}>
                                    <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>System Prompt</label>
                                    {isEditing ? (
                                        <div>
                                            <textarea
                                                value={editPrompt}
                                                onChange={(e) => setEditPrompt(e.target.value)}
                                                rows={4}
                                                style={{ width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 13, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                                            />
                                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                                                <button onClick={() => setEditingId(null)} style={{ padding: "6px 12px", background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
                                                <button
                                                    onClick={() => handleUpdate(agent, { system_prompt: editPrompt })}
                                                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "rgba(34, 197, 94, 0.2)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: 8, color: "#86efac", cursor: "pointer", fontSize: 13 }}
                                                >
                                                    <Save style={{ width: 14, height: 14 }} />
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{
                                            background: "rgba(0,0,0,0.2)", padding: "12px 16px", borderRadius: 12,
                                            color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.6,
                                            border: "1px solid rgba(255,255,255,0.05)", maxHeight: 120, overflow: "auto",
                                        }}>
                                            {agent.system_prompt || <span style={{ fontStyle: "italic", opacity: 0.5 }}>No system prompt defined</span>}
                                        </div>
                                    )}
                                </div>

                                {/* Model Override */}
                                {agent.model_override?.model_id && (
                                    <div style={{ marginTop: 12 }}>
                                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Model: </span>
                                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>
                                            {models.find((m: LLMModel) => m.id === agent.model_override.model_id)?.name || agent.model_override.model_id}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
