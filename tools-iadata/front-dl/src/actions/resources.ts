"use server";

import { fetchFromBackend } from "../lib/backend";

// --- Types ---

export interface DataSource {
    id: string;
    env_id: string;
    name: string;
    type: string;
    config: any;
    indexing_config: any;
}

export interface MCPServer {
    id: string;
    env_id: string;
    name: string;
    transport_type: string;
    command?: string;
    url?: string;
    env_vars: any;
    enabled: boolean;
}

export interface OAuthStatus {
    connected: boolean;
    provider?: string;
    expires_at?: string;
}

// --- Data Sources ---

export async function getSources(envId: string): Promise<DataSource[]> {
    try {
        return await fetchFromBackend(`/resources/env/${envId}/sources`);
    } catch (err) {
        console.error("Failed to fetch sources:", err);
        return [];
    }
}

export async function createSource(data: { env_id: string; name: string; type: string; config: any }) {
    return await fetchFromBackend("/resources/sources", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function deleteSource(id: string) {
    return await fetchFromBackend(`/resources/sources/${id}`, {
        method: "DELETE",
    });
}

// --- MCP Servers ---

export async function getMCPs(envId: string): Promise<MCPServer[]> {
    try {
        return await fetchFromBackend(`/resources/env/${envId}/mcp`);
    } catch (err) {
        console.error("Failed to fetch MCP servers:", err);
        return [];
    }
}

export async function createMCP(data: { env_id: string; name: string; transport_type: string; command?: string; url?: string; env_vars: any }) {
    return await fetchFromBackend("/resources/mcp", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function deleteMCP(id: string) {
    return await fetchFromBackend(`/resources/mcp/${id}`, {
        method: "DELETE",
    });
}

// --- Ingestion ---

export async function ingestSource(sourceId: string): Promise<{ status: string; job_id: string; message: string }> {
    return await fetchFromBackend(`/resources/sources/${sourceId}/ingest`, {
        method: "POST",
    });
}

// --- OAuth ---

export async function initGoogleOAuth(sourceId: string, returnUrl?: string): Promise<{ auth_url: string }> {
    return await fetchFromBackend("/oauth/google/init", {
        method: "POST",
        body: JSON.stringify({ source_id: sourceId, return_url: returnUrl }),
    });
}

export async function initMicrosoftOAuth(sourceId: string, returnUrl?: string): Promise<{ auth_url: string }> {
    return await fetchFromBackend("/oauth/microsoft/init", {
        method: "POST",
        body: JSON.stringify({ source_id: sourceId, return_url: returnUrl }),
    });
}

export async function getOAuthStatus(sourceId: string): Promise<OAuthStatus> {
    try {
        return await fetchFromBackend(`/oauth/status/${sourceId}`);
    } catch (err) {
        return { connected: false };
    }
}

export async function disconnectOAuth(sourceId: string) {
    return await fetchFromBackend(`/oauth/disconnect/${sourceId}`, {
        method: "DELETE",
    });
}
