"use server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://back-dl:8000";

export interface LLMModel {
    id: string;
    env_id: string | null;
    name: string;
    provider: string;
    model_id: string;
    api_base_url: string | null;
    api_key_env_var: string | null;
    capabilities: Record<string, boolean>;
    default_params: Record<string, any>;
    is_default: boolean;
    enabled: boolean;
}

export interface LLMProvider {
    id: string;
    name: string;
    description: string;
    requires_api_key: boolean;
    api_key_env_var: string | null;
    default_base_url: string | null;
    popular_models: string[];
}

export interface CreateModelData {
    env_id?: string | null;
    name: string;
    provider: string;
    model_id: string;
    api_base_url?: string | null;
    api_key_env_var?: string | null;
    capabilities?: Record<string, boolean>;
    default_params?: Record<string, any>;
    is_default?: boolean;
    enabled?: boolean;
}

export interface UpdateModelData {
    name?: string;
    api_base_url?: string | null;
    api_key_env_var?: string | null;
    capabilities?: Record<string, boolean>;
    default_params?: Record<string, any>;
    is_default?: boolean;
    enabled?: boolean;
}

export async function getProviders(): Promise<LLMProvider[]> {
    const res = await fetch(`${API_BASE}/models/providers`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch providers");
    const data = await res.json();
    return data.providers;
}

export async function getModels(envId?: string): Promise<LLMModel[]> {
    const url = envId
        ? `${API_BASE}/models/env/${envId}`
        : `${API_BASE}/models/`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch models");
    return res.json();
}

export async function createModel(data: CreateModelData): Promise<LLMModel> {
    const res = await fetch(`${API_BASE}/models/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to create model: ${err}`);
    }
    return res.json();
}

export async function updateModel(id: string, data: UpdateModelData): Promise<LLMModel> {
    const res = await fetch(`${API_BASE}/models/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to update model: ${err}`);
    }
    return res.json();
}

export async function deleteModel(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/models/${id}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete model");
}
