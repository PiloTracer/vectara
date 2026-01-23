import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ConfigStatus {
    valid: boolean;
    missing_keys: string[];
    environment: string;
    docker_url: string;
}

export default function Gatekeeper() {
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<string | null>(null);
    const [status, setStatus] = useState<ConfigStatus | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [dockerState, setDockerState] = useState<string | null>(null);

    useEffect(() => {
        checkMode();
    }, []);

    async function checkMode() {
        try {
            setLoading(true);
            const currentMode = await invoke<string | null>("get_app_mode");
            if (currentMode) {
                setMode(currentMode);
                verifyConfig();
            } else {
                setLoading(false);
            }
        } catch (e) {
            setError(String(e));
            setLoading(false);
        }
    }

    async function selectMode(selected: "dev" | "prd") {
        try {
            setLoading(true);
            await invoke("set_app_mode", { mode: selected });
            setMode(selected);
            verifyConfig();
        } catch (e) {
            setError(String(e));
            setLoading(false);
        }
    }

    async function verifyConfig() {
        try {
            setLoading(true);
            const result = await invoke<ConfigStatus>("check_env_config");
            setStatus(result);
            if (result.valid) {
                checkDocker(result.docker_url);
            } else {
                setLoading(false);
            }
        } catch (e) {
            setError("Failed to check config: " + String(e));
            setLoading(false);
        }
    }

    async function checkDocker(targetUrl: string) {
        try {
            // Status: Running, Stopped, Starting, Error(...)
            const state = await invoke<{ Running?: any, Stopped?: any, Starting?: any, Error?: string }>("check_docker_status");
            console.log("Docker Status:", state);

            if (state === "Running") {
                console.log("Docker running. Redirecting...");
                window.location.href = targetUrl;
            } else if (typeof state === 'object' && state !== null && 'Error' in state) {
                setDockerState("Error: " + state.Error);
                setLoading(false);
            } else {
                setDockerState("Stopped");
                setLoading(false);
            }
        } catch (e) {
            setError("Docker Check Failed: " + String(e));
            setLoading(false);
        }
    }

    async function startDocker() {
        setLoading(true);
        try {
            const result = await invoke("start_docker");
            console.log("Start Result:", result);
            // Poll for success
            setTimeout(() => {
                if (status?.docker_url) checkDocker(status.docker_url);
            }, 5000); // Wait 5s then check again
        } catch (e) {
            setError("Failed to start docker: " + String(e));
            setLoading(false);
        }
    }

    // Render Content Helper
    const renderContent = () => {
        if (loading) {
            return (
                <div style={styles.centerBox}>
                    <h2>🔄 Agentic Gatekeeper</h2>
                    <p>Verifying Environment Integrity...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div style={styles.centerBox}>
                    <h2 style={{ color: "red" }}>⚠️ System Error</h2>
                    <p>{error}</p>
                    <button style={styles.button} onClick={() => window.location.reload()}>Retry</button>
                </div>
            );
        }

        if (!mode) {
            return (
                <div style={styles.centerBox}>
                    <h2>Select Environment</h2>
                    <div style={styles.buttonGroup}>
                        <button style={styles.button} onClick={() => selectMode("dev")}>
                            Development (Local)
                        </button>
                        <button style={styles.button} onClick={() => selectMode("prd")}>
                            Production
                        </button>
                    </div>
                </div>
            );
        }

        if (status && !status.valid) {
            return (
                <div style={styles.centerBox}>
                    <h2 style={{ color: "orange" }}>⚠️ Configuration Missing</h2>
                    <p>
                        The environment <strong>{status.environment}</strong> is missing required keys:
                    </p>
                    <ul style={{ textAlign: "left" }}>
                        {status.missing_keys.map((key) => (
                            <li key={key}>{key}</li>
                        ))}
                    </ul>
                    <p>Please update <code>tools-iadata/.env.{status.environment}</code></p>
                    <button style={styles.button} onClick={verifyConfig}>Re-check Configuration</button>
                </div>
            );
        }

        // State: Docker Check
        if (dockerState) {
            return (
                <div style={styles.centerBox}>
                    <h2>🚀 Docker Services</h2>
                    <p>Status: <strong>{dockerState}</strong></p>
                    {dockerState.startsWith("Error") ? null : (
                        <button style={styles.button} onClick={startDocker}>Start Services</button>
                    )}
                    <button style={styles.button} onClick={() => status?.docker_url && checkDocker(status.docker_url)}>Refresh Status</button>
                </div>
            );
        }

        return null;
    };

    return (
        <div style={styles.container}>
            {/* Main ContentArea */}
            <div style={styles.content}>
                {renderContent()}
            </div>
        </div>
    );
}

const styles = {
    container: {
        display: "flex",
        flexDirection: "column" as const,
        height: "100vh",
        fontFamily: "sans-serif",
        backgroundColor: "#1a1a1a",
        color: "#ffffff",
    },
    content: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    centerBox: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        textAlign: "center" as const,
        maxWidth: "80%",
    },
    buttonGroup: {
        display: "flex",
        gap: "20px",
        marginTop: "20px",
    },
    button: {
        padding: "10px 20px",
        fontSize: "16px",
        cursor: "pointer",
        margin: "5px",
    },
};
