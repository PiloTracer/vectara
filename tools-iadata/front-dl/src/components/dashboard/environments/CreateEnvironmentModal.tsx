"use client";

import React, { useState } from "react";
import { createEnvironment } from "../../../actions/environments";
import { useRouter } from "next/navigation";

interface CreateEnvironmentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreateEnvironmentModal({ isOpen, onClose }: CreateEnvironmentModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createEnvironment({ name, description });
            router.refresh();
            onClose();
            setName("");
            setDescription("");
        } catch (err) {
            console.error(err);
            alert("Failed to create environment");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
            <div style={{
                backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "500px",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            }}>
                <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#f8fafc", marginBottom: "24px" }}>
                    Create Environment
                </h2>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div>
                        <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.875rem", marginBottom: "8px" }}>Name</label>
                        <input
                            required
                            value={name} onChange={(e) => setName(e.target.value)}
                            style={{ width: "100%", padding: "12px", borderRadius: "8px", backgroundColor: "#0f172a", border: "1px solid #334155", color: "white", outline: "none" }}
                            placeholder="e.g. Engineering Sandbox"
                        />
                    </div>

                    <div>
                        <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.875rem", marginBottom: "8px" }}>Description</label>
                        <textarea
                            value={description} onChange={(e) => setDescription(e.target.value)}
                            style={{ width: "100%", padding: "12px", borderRadius: "8px", backgroundColor: "#0f172a", border: "1px solid #334155", color: "white", outline: "none", minHeight: "100px" }}
                            placeholder="Brief description of this context..."
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
                        <button
                            type="button" onClick={onClose}
                            style={{ padding: "10px 20px", borderRadius: "8px", backgroundColor: "transparent", color: "#94a3b8", border: "none", cursor: "pointer" }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit" disabled={loading}
                            style={{ padding: "10px 20px", borderRadius: "8px", backgroundColor: "#3b82f6", color: "white", border: "none", cursor: loading ? "not-allowed" : "pointer", fontWeight: "600" }}
                        >
                            {loading ? "Creating..." : "Create Environment"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
