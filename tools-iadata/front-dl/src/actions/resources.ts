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
