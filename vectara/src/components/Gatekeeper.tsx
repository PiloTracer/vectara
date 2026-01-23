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
    const [formValues, setFormValues] = useState<Record<string, string>>({});

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

    async function handleSaveConfig() {
        setLoading(true);
        try {
            for (const [key, val] of Object.entries(formValues)) {
                if (val.trim()) {
                    await invoke("update_env_var", { key, value: val.trim() });
                }
            }
            setFormValues({});
            verifyConfig(); // Re-check
        } catch (e) {
            setError("Failed to save config: " + String(e));
            setLoading(false);
        }
    }

    async function checkDocker(targetUrl: string) {
        try {
            // Status: Running, Stopped, Starting, or { Error: string }
            type DockerState = "Running" | "Stopped" | "Starting" | { Error: string };
            const state = await invoke<DockerState>("check_docker_status");
            console.log("Docker Status:", state);

            if (state === "Running") {
                console.log("Docker running. Waiting for service health...");
                setDockerState("Running"); // Update UI to show "Waiting..."
                waitForService(targetUrl);
            } else if (typeof state === 'object' && 'Error' in state) {
                // It's the Error object variant
                setDockerState("Error: " + state.Error);
                setLoading(false);
            } else {
                // Stopped, Starting, or unexpected string
                setDockerState(state as string);
                setLoading(false);
            }
        } catch (e) {
            setError("Docker Check Failed: " + String(e));
            setLoading(false);
        }
    }

    async function waitForService(url: string) {
        // Poll every 1s
        const interval = setInterval(async () => {
            try {
                // mode: 'no-cors' allows opaque response; we just check if it throws (refused)
                await fetch(url, { mode: 'no-cors' });
                console.log("Service is up! Redirecting...");
                clearInterval(interval);
                window.location.href = url;
            } catch (e) {
                console.log("Waiting for service...", e);
            }
        }, 1000);

        setTimeout(() => {
            clearInterval(interval);
        }, 60000);
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
                    <button style={{ ...styles.button, marginTop: 10, backgroundColor: '#555' }} onClick={() => { setError(null); setMode(null); }}>Back to Selection</button>
                </div>
            );
        }

        if (!mode) {
            return (
                <div style={styles.centerBox}>
                    <h2>Select Environment</h2>
                    <p style={{ color: '#888', marginBottom: 20 }}>Choose the target environment to initialize.</p>
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
                    <h2 style={{ color: "orange", marginBottom: 5 }}>⚠️ Configuration Missing</h2>
                    <p style={{ marginBottom: 20 }}>
                        The <strong>{status.environment}</strong> environment requires additional setup.
                    </p>

                    <div style={{
                        textAlign: "left",
                        backgroundColor: "#2a2a2a",
                        padding: 20,
                        borderRadius: 8,
                        width: '100%',
                        marginBottom: 20,
                        boxSizing: 'border-box'
                    }}>
                        {status.missing_keys.map(key => (
                            <div key={key} style={{ marginBottom: 15 }}>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 5, fontSize: '0.9em', color: '#ccc' }}>{key}</label>
                                <input
                                    type="text"
                                    placeholder={`Enter value for ${key}`}
                                    value={formValues[key] || ""}
                                    onChange={(e) => setFormValues(prev => ({ ...prev, [key]: e.target.value }))}
                                    style={styles.input}
                                />
                            </div>
                        ))}
                        <button style={{ ...styles.button, width: '100%', backgroundColor: '#2196F3' }} onClick={handleSaveConfig}>
                            Save & Retry
                        </button>
                    </div>

                    <div style={styles.buttonGroup}>
                        <button style={{ ...styles.button, backgroundColor: '#555' }} onClick={() => { setMode(null); }}>
                            ← Different Environment
                        </button>
                    </div>
                </div>
            );
        }

        // State: Docker Check
        if (dockerState) {
            if (dockerState === "Running") {
                return (
                    <div style={styles.centerBox}>
                        <h2>⏳ Waiting for Service</h2>
                        <p>Docker is running. Waiting for <strong>front-dl</strong> to be ready...</p>
                        <div style={{ marginTop: 20 }}>
                            <div className="spinner"></div>
                        </div>
                    </div>
                );
            }

            return (
                <div style={styles.centerBox}>
                    <h2>🚀 Docker Services</h2>
                    <p>Status: <strong>{dockerState}</strong></p>
                    {dockerState.startsWith("Error") ? null : (
                        <button style={styles.button} onClick={startDocker}>Start Services</button>
                    )}
                    <button style={styles.button} onClick={() => status?.docker_url && checkDocker(status.docker_url)}>Refresh Status</button>
                    <button style={{ ...styles.button, marginLeft: 10, backgroundColor: '#555' }} onClick={() => setMode(null)}>Back to Selection</button>
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
        overflowY: 'auto' as const
    },
    centerBox: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        textAlign: "center" as const,
        maxWidth: "500px",
        width: "90%",
        padding: "20px"
    },
    buttonGroup: {
        display: "flex",
        gap: "10px",
        marginTop: "10px",
    },
    button: {
        padding: "10px 20px",
        fontSize: "14px",
        cursor: "pointer",
        margin: "0px",
        borderRadius: "4px",
        border: "none",
        backgroundColor: "#444",
        color: "white",
        fontWeight: "bold" as const
    },
    input: {
        width: "100%",
        padding: "8px",
        borderRadius: "4px",
        border: "1px solid #555",
        backgroundColor: "#111",
        color: "white",
        fontSize: "14px",
        boxSizing: "border-box" as const
    }
};
