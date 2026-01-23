import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ConfigStatus {
    valid: boolean;
    missing_keys: string[];
    environment: string;
    docker_url: string;
}

export default function Settings() {
    const [status, setStatus] = useState<ConfigStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [formValues, setFormValues] = useState<Record<string, string>>({});

    useEffect(() => {
        loadStatus();
    }, []);

    async function loadStatus() {
        try {
            setLoading(true);
            const res = await invoke<ConfigStatus>("check_env_config");
            setStatus(res);
            setLoading(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!status) return;
        setLoading(true);
        try {
            // Save all provided values
            for (const [key, val] of Object.entries(formValues)) {
                if (val.trim()) {
                    await invoke("update_env_var", { key, value: val.trim() });
                }
            }
            // Reload status to verify
            await loadStatus();
            setFormValues({}); // Clear form
        } catch (e) {
            console.error("Failed to save:", e);
            alert("Failed to save config: " + String(e));
            setLoading(false);
        }
    }

    if (loading) return <div style={styles.container}>Loading Settings...</div>;

    const valid = status?.valid ?? false;

    return (
        <div style={styles.container}>
            <h2 style={{ borderBottom: "1px solid #333", paddingBottom: "10px", width: "100%", textAlign: "center" }}>
                Settings
            </h2>

            <div style={styles.section}>
                <div style={styles.row}>
                    <span style={styles.label}>Environment:</span>
                    <span style={styles.value}>{status?.environment || "Not Set"}</span>
                </div>
                <div style={styles.row}>
                    <span style={styles.label}>Docker URL:</span>
                    <span style={styles.value}>{status?.docker_url || "N/A"}</span>
                </div>
            </div>

            <div style={styles.section}>
                <h3>
                    Status:
                    <span style={{ marginLeft: "10px", color: valid ? "#4caf50" : "#f44336" }}>
                        {valid ? "● Valid" : "● Invalid"}
                    </span>
                </h3>

                {!valid && status && (
                    <div style={styles.errorBox}>
                        <strong>Missing Keys:</strong>
                        <p style={{ fontSize: '0.9em', color: '#ccc', marginBottom: '15px' }}>
                            Please provide values for the following required environment variables:
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {status.missing_keys.map(key => (
                                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <label style={{ fontWeight: 'bold', fontSize: '12px' }}>{key}</label>
                                    <input
                                        type="text"
                                        placeholder={`Value for ${key}`}
                                        value={formValues[key] || ""}
                                        onChange={(e) => setFormValues(prev => ({ ...prev, [key]: e.target.value }))}
                                        style={styles.input}
                                    />
                                </div>
                            ))}
                        </div>
                        <button style={{ ...styles.button, marginTop: '15px', width: '100%', backgroundColor: '#2196F3' }} onClick={handleSave}>
                            Save Configuration
                        </button>
                    </div>
                )}

                {valid && (
                    <p style={{ color: "#888" }}>All required environment variables are present.</p>
                )}
            </div>

            <button style={styles.backButton} onClick={() => window.location.hash = ""}>
                Back to Dashboard
            </button>
        </div>
    );
}

const styles = {
    container: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        padding: "20px",
        height: "100vh",
        fontFamily: "sans-serif",
        backgroundColor: "#1a1a1a",
        color: "#ffffff",
        boxSizing: "border-box" as const,
    },
    section: {
        width: "100%",
        maxWidth: "400px",
        marginBottom: "20px",
    },
    row: {
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "10px",
        padding: "10px",
        backgroundColor: "#2a2a2a",
        borderRadius: "5px",
    },
    label: {
        fontWeight: "bold",
        color: "#aaa",
    },
    value: {
        fontWeight: "bold",
    },
    errorBox: {
        backgroundColor: "#3a1a1a",
        padding: "10px",
        borderRadius: "5px",
        border: "1px solid #f44336",
        textAlign: "left" as const,
    },
    backButton: {
        marginTop: "auto",
        padding: "10px 20px",
        cursor: "pointer",
        backgroundColor: "#444",
        color: "white",
        border: "none",
        borderRadius: "5px",
    },
    input: {
        padding: "8px",
        borderRadius: "4px",
        border: "1px solid #555",
        backgroundColor: "#222",
        color: "white",
        fontSize: "14px",
    },
    button: {
        padding: "10px",
        cursor: "pointer",
        color: "white",
        border: "none",
        borderRadius: "4px",
        fontWeight: "bold" as const,
    }
};
