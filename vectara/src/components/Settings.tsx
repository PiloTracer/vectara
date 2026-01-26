import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FolderManager } from "./FolderManager";

interface ConfigStatus {
    valid: boolean;
    missing_keys: string[];
    environment: string;
    docker_url: string;
}

const SECTIONS = {
    POSTGRES: ["DB_USER", "DB_PASSWORD", "DB_NAME", "DB_HOST", "DB_PORT", "DB_HOST_PORT"],
    QDRANT: ["QDRANT_HOST", "QDRANT_PORT"],
    DATA: ["DATA_SOURCES_DIR", "BACKUP_DIR", "IMPORT_DIR"],
    AUTH: ["AUTH_ISSUER_BASE", "AUTH_REALM", "AUTH_CLIENT_ID", "AUTH_CLIENT_SECRET"],
    LLM: ["USE_LOCAL_EMBEDDING", "LOCAL_MODEL_NAME", "USE_GPU"],
};

interface GpuInfo {
    available: boolean;
    name: string | null;
}

export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [envMap, setEnvMap] = useState<Record<string, string>>({});
    const [status, setStatus] = useState<ConfigStatus | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"POSTGRES" | "QDRANT" | "DATA" | "AUTH" | "LLM" | "ADVANCED">("POSTGRES");
    const [osType, setOsType] = useState<string>("unknown");
    const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [statusRes, envRes, osRes, gpuRes] = await Promise.all([
                invoke<ConfigStatus>("check_env_config"),
                invoke<Record<string, string>>("get_all_env_vars"),
                invoke<string>("get_os_type"),
                invoke<GpuInfo>("detect_gpu")
            ]);
            setStatus(statusRes);
            setEnvMap(envRes);
            setOsType(osRes);
            setGpuInfo(gpuRes);
            setLoading(false);
        } catch (e) {
            console.error(e);
            setMessage("Error loading settings: " + String(e));
            setLoading(false);
        }
    }

    async function handleSave() {
        setLoading(true);
        setMessage(null);
        try {
            for (const [key, val] of Object.entries(envMap)) {
                await invoke("update_env_var", { key, value: val });
            }
            setMessage("Configuration saved successfully.");
            await loadData();
        } catch (e) {
            setMessage("Failed to save: " + String(e));
            setLoading(false);
        }
    }

    async function handleRestartDocker() {
        if (!confirm("This will restart the Docker stack. Continue?")) return;
        setLoading(true);
        try {
            await invoke("restart_docker");
            setMessage("Docker services are restarting...");
            setTimeout(() => setLoading(false), 2000);
        } catch (e) {
            setMessage("Restart failed: " + String(e));
            setLoading(false);
        }
    }

    const getPathTooltip = (key: string, os: string) => {
        if (!key.endsWith("_DIR") && !key.endsWith("_PATH")) return null;

        let example = "/path/to/data";
        if (os === "windows") example = "C:\\Users\\Data";

        return (
            <span style={{ fontSize: '0.8em', color: '#666', fontStyle: 'italic' }}>
                Ex: {example}
            </span>
        );
    };

    // Helper to render fields for a specific section
    const renderFields = (keys: string[]) => {
        return keys.map(key => (
            <div key={key} style={styles.field}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={styles.label}>{key}</label>
                    {getPathTooltip(key, osType)}
                </div>
                <input
                    type="text"
                    value={envMap[key] || ""}
                    onChange={(e) => setEnvMap(prev => ({ ...prev, [key]: e.target.value }))}
                    style={styles.input}
                    placeholder={`Enter ${key}`}
                />
            </div>
        ));
    };

    // Calculate advanced keys (all keys NOT in known sections)
    // Calculate advanced keys (all keys NOT in known sections)
    const knownKeys = new Set([...SECTIONS.POSTGRES, ...SECTIONS.QDRANT, ...SECTIONS.DATA, ...SECTIONS.AUTH, ...SECTIONS.LLM]);
    const advancedKeys = Object.keys(envMap).filter(k => !knownKeys.has(k)).sort();

    if (loading) return (
        <div style={styles.container}>
            <div style={{ marginTop: 50 }}>Loading Configuration...</div>
        </div>
    );

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={{ margin: 0 }}>Settings</h2>
                <div style={styles.badge}>{status?.environment}</div>
            </div>

            <div style={styles.tabs}>
                <button style={activeTab === "POSTGRES" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("POSTGRES")}>Postgres</button>
                <button style={activeTab === "QDRANT" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("QDRANT")}>Qdrant</button>
                <button style={activeTab === "DATA" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("DATA")}>Data Sources</button>
                <button style={activeTab === "AUTH" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("AUTH")}>Authentication</button>
                <button style={activeTab === "LLM" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("LLM")}>LLM & AI</button>
                <button style={activeTab === "ADVANCED" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("ADVANCED")}>Advanced</button>
            </div>

            <div style={styles.content}>
                {message && (
                    <div style={{
                        padding: 10,
                        marginBottom: 20,
                        backgroundColor: message.startsWith("Error") || message.startsWith("Failed") ? "#4a1a1a" : "#1a4a1a",
                        border: `1px solid ${message.startsWith("Error") || message.startsWith("Failed") ? "#f44336" : "#4caf50"}`,
                        borderRadius: 4
                    }}>
                        {message}
                    </div>
                )}

                <div style={styles.card}>
                    <div style={styles.grid}>
                        {activeTab === "POSTGRES" && renderFields(SECTIONS.POSTGRES)}
                        {activeTab === "QDRANT" && renderFields(SECTIONS.QDRANT)}
                        {activeTab === "DATA" && (
                            <>
                                {renderFields(SECTIONS.DATA)}
                                <div style={{ marginTop: 20 }}>
                                    <FolderManager />
                                </div>
                            </>
                        )}
                        {activeTab === "AUTH" && renderFields(SECTIONS.AUTH)}
                        {activeTab === "LLM" && (
                            <>
                                <div style={{
                                    padding: '10px 15px',
                                    backgroundColor: gpuInfo?.available ? '#1a4a1a' : '#4a3a1a',
                                    borderRadius: 4,
                                    border: `1px solid ${gpuInfo?.available ? '#4caf50' : '#ff9800'}`,
                                    fontSize: '0.9em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    marginBottom: 10
                                }}>
                                    <div style={{
                                        width: 10, height: 10, borderRadius: '50%',
                                        backgroundColor: gpuInfo?.available ? '#4caf50' : '#ff9800'
                                    }} />
                                    {gpuInfo?.available
                                        ? `GPU Detected: ${gpuInfo.name}`
                                        : "Running on CPU Mode (Slower Inference)"}
                                </div>
                                <div style={styles.field}>
                                    <label style={styles.label}>Enable Local AI Stack</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 10 }}>
                                            <input
                                                type="checkbox"
                                                checked={envMap["USE_LOCAL_EMBEDDING"] === "true"}
                                                onChange={(e) => setEnvMap(prev => ({ ...prev, "USE_LOCAL_EMBEDDING": e.target.checked ? "true" : "false" }))}
                                            />
                                            <span>Enable Docker Service (Ollama)</span>
                                        </label>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 10 }}>
                                            <input
                                                type="checkbox"
                                                checked={envMap["USE_GPU"] === "true"}
                                                onChange={(e) => setEnvMap(prev => ({ ...prev, "USE_GPU": e.target.checked ? "true" : "false" }))}
                                            />
                                            <span>Use GPU Acceleration (Requires NVIDIA GPU)</span>
                                        </label>
                                    </div>
                                </div>
                                {["LOCAL_MODEL_NAME"].map(key => (
                                    <div key={key} style={styles.field}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <label style={styles.label}>Local Model Name</label>
                                        </div>
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            <input
                                                type="text"
                                                value={envMap[key] || ""}
                                                onChange={(e) => setEnvMap(prev => ({ ...prev, [key]: e.target.value }))}
                                                style={{ ...styles.input, flex: 1 }}
                                                placeholder={`Enter ${key}`}
                                            />
                                            <button
                                                style={{ ...styles.button, flex: '0 0 auto', backgroundColor: '#333', fontSize: '0.8em', padding: '0 15px' }}
                                                onClick={async () => {
                                                    setMessage(`Pulling model ${envMap[key]}... This may take a while.`);
                                                    setLoading(true);
                                                    try {
                                                        const res = await invoke<string>("pull_local_model", { model: envMap[key] });
                                                        setMessage(res);
                                                    } catch (e) {
                                                        setMessage("Error pulling model: " + String(e));
                                                    } finally {
                                                        setLoading(false);
                                                    }
                                                }}
                                            >
                                                Pull Model
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                        {activeTab === "ADVANCED" && (
                            <>
                                <p style={{ color: '#888', fontSize: '0.9em', margin: '0 0 15px 0' }}>
                                    These variables are managed automatically or generally do not need changing.
                                </p>
                                {renderFields(advancedKeys)}
                            </>
                        )}
                    </div>
                </div>

                <div style={styles.actions}>
                    <button style={{ ...styles.button, backgroundColor: '#2196F3' }} onClick={handleSave}>
                        Save Changes
                    </button>
                    <button style={{ ...styles.button, backgroundColor: '#FF9800' }} onClick={handleRestartDocker}>
                        Restart Services
                    </button>
                    <button style={styles.button} onClick={() => window.location.hash = ""}>
                        Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        display: "flex",
        flexDirection: "column" as const,
        height: "100vh",
        backgroundColor: "#111",
        color: "#eee",
        fontFamily: "Inter, system-ui, sans-serif",
    },
    header: {
        padding: "20px",
        backgroundColor: "#1a1a1a",
        borderBottom: "1px solid #333",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
    },
    badge: {
        padding: "4px 8px",
        backgroundColor: "#333",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: "bold" as const,
        textTransform: "uppercase" as const
    },
    tabs: {
        display: "flex",
        backgroundColor: "#222",
        borderBottom: "1px solid #333"
    },
    tab: {
        padding: "15px 20px",
        backgroundColor: "transparent",
        border: "none",
        color: "#888",
        cursor: "pointer",
        flex: 1,
        borderBottom: "3px solid transparent",
        fontSize: "14px",
        fontWeight: "bold" as const
    },
    tabActive: {
        padding: "15px 20px",
        backgroundColor: "#2a2a2a",
        border: "none",
        color: "white",
        cursor: "pointer",
        flex: 1,
        borderBottom: "3px solid #2196F3",
        fontSize: "14px",
        fontWeight: "bold" as const
    },
    content: {
        flex: 1,
        padding: "20px",
        overflowY: "auto" as const,
        maxWidth: "800px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box" as const
    },
    card: {
        backgroundColor: "#1e1e1e",
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "20px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
    },
    grid: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "15px"
    },
    field: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "5px"
    },
    label: {
        fontSize: "12px",
        color: "#888",
        fontWeight: "bold" as const
    },
    input: {
        padding: "10px",
        backgroundColor: "#2a2a2a",
        border: "1px solid #444",
        borderRadius: "4px",
        color: "white",
        fontSize: "14px",
        fontFamily: "monospace"
    },
    actions: {
        display: "flex",
        gap: "10px",
        marginTop: "20px",
        paddingBottom: "20px"
    },
    button: {
        padding: "10px 20px",
        borderRadius: "4px",
        border: "none",
        backgroundColor: "#444",
        color: "white",
        fontWeight: "bold" as const,
        cursor: "pointer",
        flex: 1
    }
};
