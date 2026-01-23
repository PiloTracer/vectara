"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Environment } from "../actions/environments";

interface EnvironmentContextType {
    activeEnvironment: Environment | null;
    activeEnvironmentId: string | null;
    setActiveEnvironment: (env: Environment | null) => void;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export function EnvironmentProvider({ children }: { children: ReactNode }) {
    const [activeEnvironment, setActiveEnvironmentState] = useState<Environment | null>(null);
    const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(null);

    // Load from localStorage on mount
    useEffect(() => {
        const storedId = localStorage.getItem("activeEnvironmentId");
        const storedEnv = localStorage.getItem("activeEnvironment");

        if (storedId) setActiveEnvironmentId(storedId);
        if (storedEnv) {
            try {
                setActiveEnvironmentState(JSON.parse(storedEnv));
            } catch (e) {
                console.error("Failed to parse stored environment", e);
            }
        }
    }, []);

    const setActiveEnvironment = (env: Environment | null) => {
        setActiveEnvironmentState(env);
        if (env) {
            setActiveEnvironmentId(env.id);
            localStorage.setItem("activeEnvironmentId", env.id);
            localStorage.setItem("activeEnvironment", JSON.stringify(env));
        } else {
            setActiveEnvironmentId(null);
            localStorage.removeItem("activeEnvironmentId");
            localStorage.removeItem("activeEnvironment");
        }
    };

    return (
        <EnvironmentContext.Provider value={{ activeEnvironment, activeEnvironmentId, setActiveEnvironment }}>
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
