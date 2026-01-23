"use server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://back-dl:8000";

export interface Agent {
    id: string;
    env_id: string;
    name: string;
    role: string;
    system_prompt: string | null;
    tools_config: Record<string, any>;
    model_override: Record<string, any>;
}

export interface RolePreset {
    id: string;
    name: string;
    icon: string;
    description: string;
    default_prompt: string;
}

export interface CreateAgentData {
    env_id: string;
    name: string;
    role: string;
    system_prompt?: string | null;
    tools_config?: Record<string, any>;
    model_override?: Record<string, any>;
}

export interface UpdateAgentData {
    name?: string;
    role?: string;
    system_prompt?: string | null;
    tools_config?: Record<string, any>;
    model_override?: Record<string, any>;
}

export async function getRolePresets(): Promise<RolePreset[]> {
    const res = await fetch(`${API_BASE}/agents/presets/roles`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch role presets");
    const data = await res.json();
    return data.roles;
}

export async function getAgents(envId: string): Promise<Agent[]> {
    const res = await fetch(`${API_BASE}/agents/env/${envId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch agents");
    return res.json();
}

export async function getAgent(agentId: string): Promise<Agent> {
    const res = await fetch(`${API_BASE}/agents/${agentId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch agent");
    return res.json();
}

export async function createAgent(data: CreateAgentData): Promise<Agent> {
    const res = await fetch(`${API_BASE}/agents/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to create agent: ${err}`);
    }
    return res.json();
}

export async function updateAgent(id: string, data: UpdateAgentData): Promise<Agent> {
    const res = await fetch(`${API_BASE}/agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to update agent: ${err}`);
    }
    return res.json();
}

export async function deleteAgent(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/agents/${id}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete agent");
}
