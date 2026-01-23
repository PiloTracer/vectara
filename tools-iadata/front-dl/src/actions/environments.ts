"use server";

import { fetchFromBackend } from "../lib/backend";

export interface Environment {
    id: string;
    name: string;
    description: string;
    owner_id: string;
    settings: any;
    created_at: string;
}

export async function getEnvironments(): Promise<Environment[]> {
    try {
        return await fetchFromBackend("/environments");
    } catch (err) {
        console.error("Failed to fetch environments:", err);
        return [];
    }
}

export async function createEnvironment(data: { name: string; description: string }) {
    return await fetchFromBackend("/environments", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function getEnvironment(id: string): Promise<Environment | null> {
    try {
        return await fetchFromBackend(`/environments/${id}`);
    } catch (err) {
        console.error(`Failed to fetch environment ${id}:`, err);
        return null;
    }
}
