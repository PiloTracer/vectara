"use server";

import { fetchFromBackend } from "../lib/backend";
import { revalidatePath } from "next/cache";

export type Environment = {
    id: string;
    name: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
    // Add other fields as needed based on backend model
};

export async function getEnvironments(): Promise<Environment[]> {
    return await fetchFromBackend("/environments/");
}

export async function createEnvironment(data: { name: string; description?: string }): Promise<Environment> {
    const res = await fetchFromBackend("/environments/", {
        method: "POST",
        body: JSON.stringify(data),
    });
    revalidatePath("/dashboard/environments");
    return res;
}

export async function deleteEnvironment(id: string): Promise<void> {
    await fetchFromBackend(`/environments/${id}`, {
        method: "DELETE",
    });
    revalidatePath("/dashboard/environments");
}
