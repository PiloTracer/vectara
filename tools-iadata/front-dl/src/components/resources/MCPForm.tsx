"use client";

import React, { useState } from "react";
import { createMCP } from "../../actions/resources";
import { Loader2, Terminal, Globe, Save, Plus, X } from "lucide-react";

interface MCPFormProps {
    envId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export function MCPForm({ envId, onSuccess, onCancel }: MCPFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [type, setType] = useState("STDIO");
    const [name, setName] = useState("");

    const [command, setCommand] = useState("");
    const [url, setUrl] = useState("");

    // Simple Env Vars Editor (Array of key-value pairs)
    const [envVars, setEnvVars] = useState<{ key: string, value: string }[]>([{ key: "", value: "" }]);

    const addEnvVar = () => setEnvVars([...envVars, { key: "", value: "" }]);
    const removeEnvVar = (index: number) => setEnvVars(envVars.filter((_, i) => i !== index));
    const updateEnvVar = (index: number, field: 'key' | 'value', val: string) => {
        const newVars = [...envVars];
        newVars[index][field] = val;
        setEnvVars(newVars);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Convert array back to object
        const envVarObj = envVars.reduce((acc, curr) => {
            if (curr.key) acc[curr.key] = curr.value;
            return acc;
        }, {} as any);

        try {
            await createMCP({
                env_id: envId,
                name,
                transport_type: type,
                command: type === "STDIO" ? command : undefined,
                url: type === "SSE" ? url : undefined,
                env_vars: envVarObj
            });
            onSuccess();
        } catch (err) {
            console.error("Failed to create MCP:", err);
            alert("Failed to create MCP");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">Transport Type</label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setType("STDIO")}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${type === "STDIO" ? "bg-purple-500/20 border-purple-500/50 text-purple-200" : "bg-white/5 border-transparent text-white/60 hover:bg-white/10"}`}
                    >
                        <Terminal className="w-4 h-4" />
                        <span className="text-sm font-medium">STDIO Process</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setType("SSE")}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${type === "SSE" ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-200" : "bg-white/5 border-transparent text-white/60 hover:bg-white/10"}`}
                    >
                        <Globe className="w-4 h-4" />
                        <span className="text-sm font-medium">SSE Endpoint</span>
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">Name</label>
                <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-white/20"
                    placeholder="e.g. Postgres MCP"
                />
            </div>

            {type === "STDIO" && (
                <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">Command</label>
                    <input
                        type="text"
                        required
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors font-mono placeholder:text-white/20"
                        placeholder="npx -y @modelcontextprotocol/server-postgres ..."
                    />
                </div>
            )}

            {type === "SSE" && (
                <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">URL</label>
                    <input
                        type="url"
                        required
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors font-mono placeholder:text-white/20"
                        placeholder="http://localhost:3000/sse"
                    />
                </div>
            )}

            <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">Environment Variables</label>
                <div className="space-y-2">
                    {envVars.map((v, i) => (
                        <div key={i} className="flex gap-2">
                            <input
                                type="text"
                                value={v.key}
                                onChange={(e) => updateEnvVar(i, 'key', e.target.value)}
                                className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30 font-mono placeholder:text-white/20"
                                placeholder="KEY"
                            />
                            <input
                                type="text"
                                value={v.value}
                                onChange={(e) => updateEnvVar(i, 'value', e.target.value)}
                                className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30 font-mono placeholder:text-white/20"
                                placeholder="VALUE"
                            />
                            <button
                                type="button"
                                onClick={() => removeEnvVar(i)}
                                className="p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-lg"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addEnvVar}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-2"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Variable
                    </button>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Server
                </button>
            </div>
        </form>
    );
}
