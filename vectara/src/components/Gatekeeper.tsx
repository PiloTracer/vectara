import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import Ansi from "ansi-to-react";

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
    const [logs, setLogs] = useState<string>("");

    const initialCheckDone = useRef(false);

    useEffect(() => {
        initialCheckDone.current = false;
        checkMode();
    }, []);

    // Poll logs & Listen for events
    useEffect(() => {
        let interval: any = null;
        let unlisten: (() => void) | null = null;

        // 1. Listen for streaming events (Pulling/Startup logs)
        import("@tauri-apps/api/event").then(async ({ listen }) => {
            unlisten = await listen<string>("docker-event-log", (event) => {
                setLogs((prev) => prev + event.payload + "\n");
            });
        });

        // 2. Poll container logs once running (for existing logs)
        if (loading || dockerState === "Running" || dockerState?.startsWith("Starting")) {
            interval = setInterval(async () => {
                try {
                    // Only poll if we aren't receiving many events? 
                    // Actually, let's append polled logs only if we want history.
                    // For now, keep polling as fallback/history fetcher.
                    const output = await invoke<string>("get_docker_logs");
                    // We only replace if output is significantly different or if we want to sync state
                    // But 'output' from backend is 'tail 50'. 
                    // Let's rely on polling for the 'steady state' and events for 'startup stream'
                    if (output.length > logs.length || !logs) {
                        setLogs(output);
                    }
                } catch (e) {
                    // ignore
                }
            }, 2000);
        }

        return () => {
            if (interval) clearInterval(interval);
            if (unlisten) unlisten();
        }
    }, [loading, dockerState]);


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

    interface ServiceStatus {
        service: string;
        state: string; // running, exited
        health: string; // healthy, starting, unhealthy, ""
    }

    interface DockerResponse {
        status: "Running" | "Starting" | "Stopped" | "Error";
        error: string | null;
        services: ServiceStatus[];
    }

    async function checkDocker(targetUrl: string) {
        try {
            const response = await invoke<DockerResponse>("check_docker_status");
            console.log("Docker Response:", response);

            // Update State with the backend global response
            setDockerState(response.status);

            // Handle Error
            if (response.status === "Error" && response.error) {
                setDockerState("Error: " + response.error);
                setLoading(false);
                return;
            }

            // Logic: Pass the services list to a local state to render
            // (We might need a new state variable for services if we want to show them)
            setServices(response.services);

            if (response.status === "Running") {
                // Backend says "Running" which means ALL CRITICAL services are HEALTHY.
                if (!initialCheckDone.current) {
                    // Start fresh if this was the very first check
                    console.log("Initial Check: Docker running. Restarting for fresh state...");
                    initialCheckDone.current = true;
                    restartDocker(targetUrl);
                } else {
                    // We are good to go
                    setLoading(false);
                    waitForService(targetUrl);
                }
            } else if (response.status === "Starting") {
                // Keep polling
                setLoading(false);
                setTimeout(() => checkDocker(targetUrl), 2000);
            } else {
                // Stopped
                setLoading(false);
            }

        } catch (e) {
            setError("Docker Check Failed: " + String(e));
            setLoading(false);
        }
    }

    const [services, setServices] = useState<ServiceStatus[]>([]);

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
        setDockerState("Starting...");
        try {
            const result = await invoke("start_docker");
            console.log("Start Result:", result);
            initialCheckDone.current = true;
            // Immediately start polling for status
            if (status?.docker_url) {
                pollDockerStatus(status.docker_url);
            }
        } catch (e) {
            setError("Failed to start docker: " + String(e));
            setLoading(false);
        }
    }

    // New polling function that runs during startup
    async function pollDockerStatus(targetUrl: string) {
        const poll = async () => {
            try {
                const response = await invoke<DockerResponse>("check_docker_status");
                console.log("Poll Result:", response);
                setServices(response.services);
                setDockerState(response.status);

                if (response.status === "Running") {
                    setLoading(false);
                    waitForService(targetUrl);
                } else if (response.status === "Starting") {
                    // Keep polling every 2 seconds
                    setTimeout(poll, 2000);
                } else if (response.status === "Stopped") {
                    // Still stopped, keep trying for a bit
                    setTimeout(poll, 2000);
                } else {
                    setLoading(false);
                }
            } catch (e) {
                console.error("Poll error:", e);
                setTimeout(poll, 2000);
            }
        };
        poll();
    }

    async function restartDocker(targetUrl: string) {
        setLoading(true);
        setDockerState("Restarting...");
        try {
            setServices([]); // Clear old list
            await invoke("restart_docker");
            // Immediately start polling
            pollDockerStatus(targetUrl);
        } catch (e) {
            setError("Failed to restart docker: " + String(e));
            setLoading(false);
        }
    }

    // Render Services Helper (moved outside renderContent for reuse)
    const renderServices = () => {
        if (!services || services.length === 0) return null;
        return (
            <div style={{ width: '100%', marginTop: 20, marginBottom: 20, textAlign: 'left' }}>
                {services.map(s => {
                    let color = '#555'; // default/stopped
                    let progress = 0;
                    let statusText = s.state;

                    if (s.state === 'running') {
                        if (s.health === 'healthy') {
                            color = '#4CAF50'; // Green
                            progress = 100;
                            statusText = 'Healthy';
                        } else if (s.health === 'starting') {
                            color = '#FFC107'; // Yellow
                            progress = 40;
                            statusText = 'Starting...';
                        } else if (s.health === 'unhealthy') {
                            color = '#F44336'; // Red
                            progress = 100;
                            statusText = 'Unhealthy';
                        } else {
                            // Running but no health check
                            color = '#8BC34A'; // Light Green
                            progress = 100;
                            statusText = 'Running';
                        }
                    } else if (s.state === 'exited') {
                        color = '#9E9E9E'; // Grey
                        statusText = 'Stopped/Exited';
                    }

                    return (
                        <div key={s.service} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', marginBottom: 3 }}>
                                <span>{s.service}</span>
                                <span style={{ color: color }}>{statusText}</span>
                            </div>
                            <div style={{ width: '100%', height: 4, backgroundColor: '#333', borderRadius: 2 }}>
                                <div style={{ width: `${progress}%`, height: '100%', backgroundColor: color, borderRadius: 2, transition: 'width 0.5s ease' }}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Render Content Helper
    const renderContent = () => {
        if (loading) {
            return (
                <div style={styles.centerBox}>
                    <h2>⏳ Starting Services</h2>
                    <p style={{ color: '#888' }}>{dockerState || "Initializing..."}</p>
                    {renderServices()}
                    <LogTerminal logs={logs} />
                </div>
            );
        }

        if (error) {
            return (
                <div style={styles.centerBox}>
                    <h2 style={{ color: "red" }}>⚠️ System Error</h2>
                    <p>{error}</p>
                    <button style={styles.button} onClick={() => window.location.reload()}>Retry</button>
                    <button style={{ ...styles.button, marginTop: 10, backgroundColor: '#555' }} onClick={async () => { await invoke("stop_docker"); setError(null); setMode(null); }}>Back to Selection</button>
                    <LogTerminal logs={logs} />
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
                        <button style={{ ...styles.button, backgroundColor: '#555' }} onClick={async () => { await invoke("stop_docker"); setMode(null); }}>
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
                        <h2>🚀 Launching Dashboard</h2>
                        <p>All systems healthy. Redirecting...</p>
                        {renderServices()}
                        <div style={{ marginTop: 20 }}>
                            <div className="spinner"></div>
                        </div>
                        <LogTerminal logs={logs} />
                    </div>
                );
            } else if (dockerState === "Starting") {
                return (
                    <div style={styles.centerBox}>
                        <h2>⏳ Starting Services</h2>
                        <p>Waiting for critical components...</p>
                        {renderServices()}
                        <button style={styles.button} onClick={() => status?.docker_url && checkDocker(status.docker_url)}>Refresh</button>
                        <LogTerminal logs={logs} />
                    </div>
                );
            }

            return (
                <div style={styles.centerBox}>
                    <h2>🚀 Docker Services</h2>
                    <p>Status: <strong>{String(dockerState)}</strong></p>
                    {String(dockerState).startsWith("Error") ? null : (
                        <button style={styles.button} onClick={startDocker}>Start Services</button>
                    )}
                    <button style={styles.button} onClick={() => status?.docker_url && checkDocker(status.docker_url)}>Refresh Status</button>
                    <button style={{ ...styles.button, marginLeft: 10, backgroundColor: '#555' }} onClick={async () => { await invoke("stop_docker"); setMode(null); }}>Back to Selection</button>
                    <LogTerminal logs={logs} />
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

function LogTerminal({ logs }: { logs: string }) {
    const ref = useRef<HTMLPreElement>(null);
    useEffect(() => {
        if (ref.current) {
            ref.current.scrollTop = ref.current.scrollHeight;
        }
    }, [logs]);

    // Always render the container so it doesn't flash/disappear
    // if (!logs) return null; 

    return (
        <div style={{
            marginTop: 20,
            width: '100%',
            maxWidth: '600px',
            backgroundColor: '#000',
            borderRadius: 6,
            padding: 10,
            textAlign: 'left',
            boxSizing: 'border-box'
        }}>
            <div style={{ fontSize: '0.8em', color: '#666', borderBottom: '1px solid #333', paddingBottom: 5, marginBottom: 5 }}>Docker Logs (Real-time)</div>
            <pre ref={ref} style={{
                height: '200px',
                overflowY: 'auto',
                fontSize: '0.75em',
                color: '#ccc', // Changed default color to grey as ANSI will handle colors
                fontFamily: 'monospace',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
            }}>
                <Ansi>{logs || "> Connecting to Docker Daemon...\n> Waiting for startup logs..."}</Ansi>
            </pre>
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
