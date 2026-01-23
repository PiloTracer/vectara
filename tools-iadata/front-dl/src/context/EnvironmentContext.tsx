"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Environment, getEnvironment } from "../actions/environments";

interface EnvironmentContextType {
    activeEnvironmentId: string | null;
    setActiveEnvironmentId: (id: string | null) => void;
    activeEnvironment: Environment | null;
    isLoading: boolean;
    refresh: () => void;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
    const [activeEnvironmentId, setActiveEnvironmentIdState] = useState<string | null>(null);
    const [activeEnvironment, setActiveEnvironment] = useState<Environment | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Hydrate ID from localStorage
    useEffect(() => {
        const savedId = localStorage.getItem("activeEnvironmentId");
        if (savedId) {
            setActiveEnvironmentIdState(savedId);
        }
    }, []);

    // Fetch active environment details when ID changes
    useEffect(() => {
        async function fetchEnv() {
            if (!activeEnvironmentId) {
                setActiveEnvironment(null);
                return;
            }
            setIsLoading(true);
            try {
                const env = await getEnvironment(activeEnvironmentId);
                setActiveEnvironment(env);
            } catch (err) {
                console.error("Failed to fetch active environment", err);
                // If 404, we might want to unset the ID, but for now let's just leave it
            } finally {
                setIsLoading(false);
            }
        }

        fetchEnv();
    }, [activeEnvironmentId]);

    const setActiveEnvironmentId = (id: string | null) => {
        setActiveEnvironmentIdState(id);
        if (id) {
            localStorage.setItem("activeEnvironmentId", id);
        } else {
            localStorage.removeItem("activeEnvironmentId");
            setActiveEnvironment(null);
        }
    };

    const refresh = () => {
        if (activeEnvironmentId) {
            // Trigger re-fetch
            // A quick hack is to briefly unset then set, but better to extract fetch logic.
            // For now, we rely on ID change.
        }
    };

    return (
        <EnvironmentContext.Provider value={{ activeEnvironmentId, setActiveEnvironmentId, activeEnvironment, isLoading, refresh }}>
            {children}
        </EnvironmentContext.Provider>
    );
}

export function useEnvironment() {
    const context = useContext(EnvironmentContext);
    if (context === undefined) {
        throw new Error("useEnvironment must be used within an EnvironmentProvider");
    }
    return context;
}
