"use client";

import React, { useEffect, useState } from "react";
import { useEnvironment } from "../../../context/EnvironmentContext";
import { getModels, getProviders, createModel, deleteModel, updateModel, LLMModel, LLMProvider } from "../../../actions/models";
import { Loader2, Plus, Cpu, Cloud, Trash2, Star, Settings, ExternalLink, X } from "lucide-react";
import { useToast } from "../../../components/ui/Toast";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";

export default function ModelsPage() {
    const { addToast } = useToast();
    const { activeEnvironmentId, activeEnvironment } = useEnvironment();

    const [models, setModels] = useState<LLMModel[]>([]);
    const [providers, setProviders] = useState<LLMProvider[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    // Form state
    const [selectedProvider, setSelectedProvider] = useState<LLMProvider | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        model_id: "",
        api_base_url: "",
        api_key_env_var: "",
        is_default: false,
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [modelsData, providersData] = await Promise.all([
                getModels(activeEnvironmentId || undefined),
                getProviders()
            ]);
            setModels(modelsData);
            setProviders(providersData);
        } catch (err) {
            console.error("Failed to fetch data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeEnvironmentId]);

    const handleProviderSelect = (provider: LLMProvider) => {
        setSelectedProvider(provider);
        setFormData({
            name: "",
            model_id: provider.popular_models[0] || "",
            api_base_url: provider.default_base_url || "",
            api_key_env_var: provider.api_key_env_var || "",
            is_default: false,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProvider) return;

        try {
            await createModel({
                env_id: activeEnvironmentId,
                name: formData.name || `${selectedProvider.name} - ${formData.model_id}`,
                provider: selectedProvider.id,
                model_id: formData.model_id,
                api_base_url: formData.api_base_url || null,
                api_key_env_var: formData.api_key_env_var || null,
                is_default: formData.is_default,
                enabled: true,
            });
            setIsCreating(false);
            setSelectedProvider(null);
            fetchData();
        } catch (err) {
            console.error("Failed to create model:", err);
            addToast("error", "Failed to create model");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteModel(id);
            fetchData();
            addToast("success", "Model deleted");
        } catch (err) {
            console.error("Failed to delete:", err);
            addToast("error", "Failed to delete model");
        }
    };

    const handleSetDefault = async (model: LLMModel) => {
        try {
            await updateModel(model.id, { is_default: true });
            fetchData();
        } catch (err) {
            console.error("Failed to set default:", err);
        }
    };

    const getProviderIcon = (provider: string) => {
        if (provider === "ollama") return <Cpu style={{ width: 20, height: 20 }} />;
        return <Cloud style={{ width: 20, height: 20 }} />;
    };

    const getProviderColor = (provider: string) => {
        switch (provider) {
            case "ollama": return { bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.3)", text: "#86efac" };
            case "openai": return { bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.3)", text: "#6ee7b7" };
            case "anthropic": return { bg: "rgba(217, 119, 87, 0.15)", border: "rgba(217, 119, 87, 0.3)", text: "#f9a875" };
            case "google": return { bg: "rgba(66, 133, 244, 0.15)", border: "rgba(66, 133, 244, 0.3)", text: "#93c5fd" };
            default: return { bg: "rgba(148, 163, 184, 0.15)", border: "rgba(148, 163, 184, 0.3)", text: "#cbd5e1" };
        }
    };

    return (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
            {/* Header */}
            <header style={{
                marginBottom: 32,
                paddingBottom: 24,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
                <h1 style={{ fontSize: "2rem", fontWeight: 300, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
                    Models
                </h1>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 8 }}>
                    Configure LLM providers for {activeEnvironment?.name || "your environment"}
                </p>
            </header>

            {/* Controls */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 20px",
                            background: "#fff",
                            color: "#000",
                            border: "none",
                            borderRadius: 12,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            boxShadow: "0 4px 20px rgba(255,255,255,0.15)",
                        }}
                    >
                        <Plus style={{ width: 16, height: 16 }} />
                        Add Model
                    </button>
                )}
            </div>

            {/* Create Form */}
            {isCreating && (
                <div style={{
                    background: "linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 24,
                    padding: 32,
                    marginBottom: 32,
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                        <h3 style={{ fontSize: "1.25rem", fontWeight: 500, color: "#fff", margin: 0 }}>
                            {selectedProvider ? `Configure ${selectedProvider.name}` : "Select Provider"}
                        </h3>
                        <button
                            onClick={() => { setIsCreating(false); setSelectedProvider(null); }}
                            style={{ padding: 8, background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8, cursor: "pointer", color: "rgba(255,255,255,0.4)" }}
                            aria-label="Close"
                        >
                            <X style={{ width: 20, height: 20 }} />
                        </button>
                    </div>
                    </div>

                    {!selectedProvider ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
                            {providers.map((provider) => {
                                const colors = getProviderColor(provider.id);
                                return (
                                    <button
                                        key={provider.id}
                                        onClick={() => handleProviderSelect(provider)}
                                        style={{
                                            padding: 20,
                                            background: colors.bg,
                                            border: `1px solid ${colors.border}`,
                                            borderRadius: 16,
                                            cursor: "pointer",
                                            textAlign: "left",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                                            <span style={{ color: colors.text }}>{getProviderIcon(provider.id)}</span>
                                            <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{provider.name}</span>
                                        </div>
                                        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                                            {provider.description}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            {/* Model Selection */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                    Model
                                </label>
                                <select
                                    value={formData.model_id}
                                    onChange={(e) => setFormData({ ...formData, model_id: e.target.value })}
                                    style={{
                                        width: "100%",
                                        padding: "12px 16px",
                                        background: "rgba(0,0,0,0.3)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: 12,
                                        color: "#fff",
                                        fontSize: 14,
                                    }}
                                >
                                    {selectedProvider.popular_models.map((m) => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                    <option value="__custom__">Custom model ID...</option>
                                </select>
                                {formData.model_id === "__custom__" && (
                                    <input
                                        type="text"
                                        placeholder="Enter model ID"
                                        onChange={(e) => setFormData({ ...formData, model_id: e.target.value })}
                                        style={{
                                            width: "100%",
                                            marginTop: 8,
                                            padding: "12px 16px",
                                            background: "rgba(0,0,0,0.3)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            borderRadius: 12,
                                            color: "#fff",
                                            fontSize: 14,
                                        }}
                                    />
                                )}
                            </div>

                            {/* Display Name */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                    Display Name (optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={`${selectedProvider.name} - ${formData.model_id}`}
                                    style={{
                                        width: "100%",
                                        padding: "12px 16px",
                                        background: "rgba(0,0,0,0.3)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: 12,
                                        color: "#fff",
                                        fontSize: 14,
                                    }}
                                />
                            </div>

                            {/* API Key Env Var (if required) */}
                            {selectedProvider.requires_api_key && (
                                <div>
                                    <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                        API Key Environment Variable
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.api_key_env_var}
                                        onChange={(e) => setFormData({ ...formData, api_key_env_var: e.target.value })}
                                        placeholder={selectedProvider.api_key_env_var || "API_KEY"}
                                        style={{
                                            width: "100%",
                                            padding: "12px 16px",
                                            background: "rgba(0,0,0,0.3)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            borderRadius: 12,
                                            color: "#fff",
                                            fontSize: 14,
                                            fontFamily: "monospace",
                                        }}
                                    />
                                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                                        Set this environment variable in your .env file
                                    </p>
                                </div>
                            )}

                            {/* Base URL */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                    API Base URL
                                </label>
                                <input
                                    type="text"
                                    value={formData.api_base_url}
                                    onChange={(e) => setFormData({ ...formData, api_base_url: e.target.value })}
                                    placeholder={selectedProvider.default_base_url || "https://api.example.com"}
                                    style={{
                                        width: "100%",
                                        padding: "12px 16px",
                                        background: "rgba(0,0,0,0.3)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: 12,
                                        color: "#fff",
                                        fontSize: 14,
                                        fontFamily: "monospace",
                                    }}
                                />
                            </div>

                            {/* Default toggle */}
                            <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={formData.is_default}
                                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                                    style={{ width: 18, height: 18 }}
                                />
                                <span style={{ color: "#fff", fontSize: 14 }}>Set as default model</span>
                            </label>

                            {/* Submit */}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedProvider(null)}
                                    style={{ padding: "10px 20px", background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 14 }}
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: "10px 24px",
                                        background: "#fff",
                                        color: "#000",
                                        border: "none",
                                        borderRadius: 12,
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                    }}
                                >
                                    Add Model
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* Loading */}
            {isLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
                    <Loader2 style={{ width: 40, height: 40, color: "#22d3ee", animation: "spin 1s linear infinite" }} />
                </div>
            ) : models.length === 0 ? (
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "80px 32px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 24,
                    border: "2px dashed rgba(255,255,255,0.1)",
                }}>
                    <Cpu style={{ width: 48, height: 48, color: "rgba(255,255,255,0.2)", marginBottom: 24 }} />
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 500, color: "#fff", marginBottom: 8 }}>
                        No Models Configured
                    </h3>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 400 }}>
                        Add LLM models to use with your agents. Supports local models via Ollama and API providers like OpenAI and Anthropic.
                    </p>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
                    {models.map((model) => {
                        const colors = getProviderColor(model.provider);
                        return (
                            <div
                                key={model.id}
                                style={{
                                    background: "linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)",
                                    border: model.is_default ? `1px solid ${colors.border}` : "1px solid rgba(255, 255, 255, 0.1)",
                                    borderRadius: 20,
                                    padding: 24,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 16,
                                    position: "relative",
                                }}
                            >
                                {model.is_default && (
                                    <div style={{
                                        position: "absolute",
                                        top: 12,
                                        right: 12,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        padding: "4px 8px",
                                        background: colors.bg,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: 999,
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: colors.text,
                                    }}>
                                        <Star style={{ width: 12, height: 12 }} />
                                        DEFAULT
                                    </div>
                                )}

                                {/* Header */}
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 14,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: colors.bg,
                                        border: `1px solid ${colors.border}`,
                                        color: colors.text,
                                    }}>
                                        {getProviderIcon(model.provider)}
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff", margin: 0 }}>
                                            {model.name}
                                        </h4>
                                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: 0, marginTop: 2 }}>
                                            {model.provider.toUpperCase()}
                                        </p>
                                    </div>
                                </div>

                                {/* Model ID */}
                                <div style={{
                                    background: "rgba(0,0,0,0.3)",
                                    padding: "10px 12px",
                                    borderRadius: 12,
                                    fontFamily: "monospace",
                                    fontSize: 13,
                                    color: "rgba(255,255,255,0.6)",
                                    border: "1px solid rgba(255,255,255,0.05)",
                                }}>
                                    {model.model_id}
                                </div>

                                {/* Footer */}
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    paddingTop: 16,
                                    marginTop: "auto",
                                    borderTop: "1px solid rgba(255,255,255,0.05)",
                                }}>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {!model.is_default && (
                                            <button
                                                onClick={() => handleSetDefault(model)}
                                                style={{
                                                    padding: "6px 12px",
                                                    background: "rgba(255,255,255,0.05)",
                                                    border: "none",
                                                    borderRadius: 8,
                                                    color: "rgba(255,255,255,0.5)",
                                                    fontSize: 12,
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                }}
                                            >
                                                <Star style={{ width: 12, height: 12 }} />
                                                Set Default
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setDeleteTarget(model.id)}
                                        style={{
                                            padding: 8,
                                            background: "transparent",
                                            border: "none",
                                            borderRadius: 8,
                                            color: "rgba(255,255,255,0.2)",
                                            cursor: "pointer",
                                        }}
                                        aria-label="Delete model"
                                    >
                                        <Trash2 style={{ width: 16, height: 16 }} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
        <ConfirmDialog
            open={deleteTarget !== null}
            title="Delete Model"
            message="Remove this model configuration?"
            variant="danger"
            confirmLabel="Delete"
            onConfirm={() => {
                if (deleteTarget) handleDelete(deleteTarget);
                setDeleteTarget(null);
            }}
            onCancel={() => setDeleteTarget(null)}
        />
    );
}
