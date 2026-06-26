"use client";

import React, { useState } from "react";
import { createSource } from "../../actions/resources";
import { Loader2, Folder, Link as LinkIcon, Save, X, Cloud, Building2 } from "lucide-react";
import { useToast } from "../ui/Toast";

interface DataSourceFormProps {
    envId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export function DataSourceForm({ envId, onSuccess, onCancel }: DataSourceFormProps) {
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Feature flag: Hide "LOCAL" if not enabled.
    const useLocalEmbedding = process.env.NEXT_PUBLIC_USE_LOCAL_EMBEDDING === "true";

    const [type, setType] = useState(useLocalEmbedding ? "LOCAL" : "WEB");
    const [name, setName] = useState("");

    // Dynamic fields
    const [path, setPath] = useState("");
    const [url, setUrl] = useState("");

    // Bridge State
    const [subType, setSubType] = useState<"VOLUME" | "BRIDGE">("VOLUME");
    const [bridgeId, setBridgeId] = useState("");
    const [bridgePath, setBridgePath] = useState("");
    const [isBridgeLoading, setIsBridgeLoading] = useState(false);

    // Cloud source fields
    const [folderId, setFolderId] = useState("");
    const [siteUrl, setSiteUrl] = useState("");
    const [sharePointFolder, setSharePointFolder] = useState("");

    const handleBridgeChoose = async () => {
        setIsBridgeLoading(true);
        try {
            // Browser calls localhost:3737 (Host)
            const res = await fetch("http://localhost:3737/api/dialog/open", { method: "POST" });
            const data = await res.json();

            if (data.success && data.path_id) {
                setBridgeId(data.path_id);
                setBridgePath(data.path || "Selected Folder");
                // Clear name if empty
                if (!name) {
                    const parts = (data.path || "").split(/[/\\]/);
                    setName(parts[parts.length - 1] || "Local Folder");
                }
            } else if (data.error) {
                addToast("error", data.error);
            }
        } catch (e) {
            console.error(e);
            addToast("error", "Could not connect to Bridge Server. Is the Desktop App running?");
        } finally {
            setIsBridgeLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        let config: any = {};
        let finalType = type;

        if (type === "LOCAL") {
            if (subType === "BRIDGE") {
                if (!bridgeId) {
                    addToast("warning", "Please select a folder first.");
                    setIsLoading(false);
                    return;
                }
                finalType = "LOCAL_BRIDGE";
                config = { bridge_id: bridgeId, display_path: bridgePath };
            } else {
                config = { path };
            }
        } else if (type === "WEB") {
            config = { url };
        } else if (type === "GOOGLE_DRIVE") {
            config = { folder_id: folderId || "root" };
        } else if (type === "SHAREPOINT") {
            if (!siteUrl) {
                addToast("warning", "Please enter the SharePoint site URL.");
                setIsLoading(false);
                return;
            }
            config = { site_url: siteUrl, folder: sharePointFolder };
        }

        try {
            await createSource({
                env_id: envId,
                name,
                type: finalType,
                config
            });
            onSuccess();
        } catch (err) {
            console.error("Failed to create source:", err);
            addToast("error", "Failed to create source");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">
                    Source Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                    {useLocalEmbedding && (
                        <button
                            type="button"
                            onClick={() => setType("LOCAL")}
                            className={`
                                relative group flex flex-col items-start gap-3 p-5 rounded-xl border text-left transition-all duration-300
                                ${type === "LOCAL"
                                    ? "bg-amber-500/10 border-amber-500/50 shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]"
                                    : "bg-slate-900/50 border-white/5 hover:border-white/10 hover:bg-slate-800/50"
                                }
                            `}
                        >
                            <div className={`p-2 rounded-lg ${type === 'LOCAL' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                                <Folder className="w-5 h-5" />
                            </div>
                            <div>
                                <span className={`block text-sm font-semibold ${type === 'LOCAL' ? 'text-amber-100' : 'text-slate-200'}`}>
                                    Local Directory
                                </span>
                                <span className="text-xs text-slate-500 mt-0.5 block">
                                    Index files from a host folder
                                </span>
                            </div>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setType("WEB")}
                        className={`
                            relative group flex flex-col items-start gap-3 p-5 rounded-xl border text-left transition-all duration-300
                            ${type === "WEB"
                                ? "bg-blue-500/10 border-blue-500/50 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]"
                                : "bg-slate-900/50 border-white/5 hover:border-white/10 hover:bg-slate-800/50"
                            }
                        `}
                    >
                        <div className={`p-2 rounded-lg ${type === 'WEB' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                            <LinkIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <span className={`block text-sm font-semibold ${type === 'WEB' ? 'text-blue-100' : 'text-slate-200'}`}>
                                Web Resource
                            </span>
                            <span className="text-xs text-slate-500 mt-0.5 block">
                                Scrape URL or connect via API
                            </span>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setType("GOOGLE_DRIVE")}
                        className={`
                            relative group flex flex-col items-start gap-3 p-5 rounded-xl border text-left transition-all duration-300
                            ${type === "GOOGLE_DRIVE"
                                ? "bg-green-500/10 border-green-500/50 shadow-[0_0_20px_-5px_rgba(34,197,94,0.3)]"
                                : "bg-slate-900/50 border-white/5 hover:border-white/10 hover:bg-slate-800/50"
                            }
                        `}
                    >
                        <div className={`p-2 rounded-lg ${type === 'GOOGLE_DRIVE' ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                            <Cloud className="w-5 h-5" />
                        </div>
                        <div>
                            <span className={`block text-sm font-semibold ${type === 'GOOGLE_DRIVE' ? 'text-green-100' : 'text-slate-200'}`}>
                                Google Drive
                            </span>
                            <span className="text-xs text-slate-500 mt-0.5 block">
                                Connect via Google OAuth
                            </span>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setType("SHAREPOINT")}
                        className={`
                            relative group flex flex-col items-start gap-3 p-5 rounded-xl border text-left transition-all duration-300
                            ${type === "SHAREPOINT"
                                ? "bg-purple-500/10 border-purple-500/50 shadow-[0_0_20px_-5px_rgba(168,85,247,0.3)]"
                                : "bg-slate-900/50 border-white/5 hover:border-white/10 hover:bg-slate-800/50"
                            }
                        `}
                    >
                        <div className={`p-2 rounded-lg ${type === 'SHAREPOINT' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <span className={`block text-sm font-semibold ${type === 'SHAREPOINT' ? 'text-purple-100' : 'text-slate-200'}`}>
                                SharePoint
                            </span>
                            <span className="text-xs text-slate-500 mt-0.5 block">
                                Microsoft 365 document library
                            </span>
                        </div>
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-3">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">
                        Name
                    </label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="
                            w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3.5
                            text-sm text-white placeholder:text-slate-500
                            focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20
                            transition-all duration-200
                        "
                        placeholder="e.g. Project Documentation"
                    />
                </div>

                {type === "LOCAL" && useLocalEmbedding && (
                    <div className="space-y-4">
                        <div className="flex gap-4 mb-2">
                            <label className={`
                                flex items-center gap-2 cursor-pointer
                                text-sm ${subType === "VOLUME" ? "text-amber-400 font-bold" : "text-slate-500"}
                            `}>
                                <input
                                    type="radio"
                                    name="subType"
                                    checked={subType === "VOLUME"}
                                    onChange={() => setSubType("VOLUME")}
                                    className="hidden"
                                />
                                <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center">
                                    {subType === "VOLUME" && <span className="w-1.5 h-1.5 bg-current rounded-full" />}
                                </span>
                                Docker Volume
                            </label>
                            <label className={`
                                flex items-center gap-2 cursor-pointer
                                text-sm ${subType === "BRIDGE" ? "text-amber-400 font-bold" : "text-slate-500"}
                            `}>
                                <input
                                    type="radio"
                                    name="subType"
                                    checked={subType === "BRIDGE"}
                                    onChange={() => setSubType("BRIDGE")}
                                    className="hidden"
                                />
                                <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center">
                                    {subType === "BRIDGE" && <span className="w-1.5 h-1.5 bg-current rounded-full" />}
                                </span>
                                Host System (Bridge)
                            </label>
                        </div>

                        {subType === "VOLUME" ? (
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider ml-1">
                                    Directory Path
                                </label>
                                <div className="
                                    flex items-center w-full bg-slate-900 border border-amber-500/30 rounded-xl px-4 py-3.5
                                    focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/20
                                    transition-all duration-200
                                ">
                                    <span className="text-sm font-mono text-slate-400 select-none mr-1 border-r border-slate-700 pr-3">DATA_SOURCES_DIR/</span>
                                    <input
                                        type="text"
                                        required
                                        value={path}
                                        onChange={(e) => setPath(e.target.value)}
                                        className="
                                            flex-1 bg-transparent border-none p-0 ml-2
                                            text-sm font-mono text-amber-300 placeholder:text-slate-500
                                            focus:ring-0 focus:outline-none
                                        "
                                        placeholder="my-docs"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500 ml-1">
                                    Relative to the configured data sources volume on the host.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider ml-1">
                                    Select Host Folder
                                </label>
                                <div className="flex gap-3">
                                    <div className="
                                        flex-1 flex items-center bg-slate-900 border border-amber-500/30 rounded-xl px-4 py-3.5
                                    ">
                                        <Folder className="w-4 h-4 text-amber-500 mr-3" />
                                        <span className={`text-sm font-mono ${bridgePath ? "text-amber-300" : "text-slate-500 italic"}`}>
                                            {bridgePath || "No folder selected"}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleBridgeChoose}
                                        disabled={isBridgeLoading}
                                        className="
                                            px-6 py-2 bg-amber-500/10 border border-amber-500/50 
                                            text-amber-400 text-sm font-bold rounded-xl
                                            hover:bg-amber-500/20 hover:border-amber-400
                                            transition-all
                                        "
                                    >
                                        {isBridgeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Choose..."}
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-500 ml-1">
                                    Uses API Bridge to access any folder on your computer.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {type === "WEB" && (
                    <div className="space-y-3">
                        <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">
                            Target URL
                        </label>
                        <div className="relative">
                            <div className="absolute left-4 top-4 text-slate-400 pointer-events-none">
                                <LinkIcon className="w-4 h-4" />
                            </div>
                            <input
                                type="url"
                                required
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="
                                    w-full bg-slate-900 border border-slate-700 rounded-xl pl-11 pr-4 py-3.5
                                    text-sm font-mono text-cyan-200 placeholder:text-slate-500
                                    focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20
                                    transition-all duration-200
                                "
                                placeholder="https://example.com/api/docs"
                            />
                        </div>
                    </div>
                )}

                {type === "GOOGLE_DRIVE" && (
                    <div className="space-y-3">
                        <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">
                            Google Drive Folder ID
                        </label>
                        <div className="relative">
                            <div className="absolute left-4 top-4 text-slate-400 pointer-events-none">
                                <Cloud className="w-4 h-4" />
                            </div>
                            <input
                                type="text"
                                required
                                value={folderId}
                                onChange={(e) => setFolderId(e.target.value)}
                                className="
                                    w-full bg-slate-900 border border-slate-700 rounded-xl pl-11 pr-4 py-3.5
                                    text-sm font-mono text-green-200 placeholder:text-slate-500
                                    focus:outline-none focus:border-green-500/60 focus:ring-2 focus:ring-green-500/20
                                    transition-all duration-200
                                "
                                placeholder="1B2M2Y8As2..."
                            />
                        </div>
                        <p className="text-[11px] text-slate-500 ml-1">
                            The ID from the folder URL (e.g. drive.google.com/drive/folders/<b>ID</b>)
                        </p>
                    </div>
                )}

                {type === "SHAREPOINT" && (
                    <div className="space-y-4">
                        <div className="space-y-3">
                            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">
                                SharePoint Site URL
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-4 text-slate-400 pointer-events-none">
                                    <Building2 className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={siteUrl}
                                    onChange={(e) => setSiteUrl(e.target.value)}
                                    className="
                                        w-full bg-slate-900 border border-slate-700 rounded-xl pl-11 pr-4 py-3.5
                                        text-sm font-mono text-purple-200 placeholder:text-slate-500
                                        focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20
                                        transition-all duration-200
                                    "
                                    placeholder="mycompany.sharepoint.com/sites/Marketing"
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">
                                Document Library / Path
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-4 text-slate-400 pointer-events-none">
                                    <Folder className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    value={sharePointFolder}
                                    onChange={(e) => setSharePointFolder(e.target.value)}
                                    className="
                                        w-full bg-slate-900 border border-slate-700 rounded-xl pl-11 pr-4 py-3.5
                                        text-sm font-mono text-purple-200 placeholder:text-slate-500
                                        focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20
                                        transition-all duration-200
                                    "
                                    placeholder="Shared Documents/Reports (Optional)"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-4 pt-10 border-t border-slate-700/50 mt-12">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isLoading}
                    className="
                        px-5 py-3 text-sm font-medium text-slate-400 
                        hover:text-white hover:bg-slate-800 
                        rounded-xl border border-transparent hover:border-slate-700
                        transition-all duration-200
                    "
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="
                        flex items-center gap-2.5 px-8 py-3
                        bg-gradient-to-r from-cyan-500 to-blue-500
                        text-white text-sm font-bold rounded-xl 
                        shadow-lg shadow-cyan-500/25
                        hover:from-cyan-400 hover:to-blue-400
                        hover:shadow-xl hover:shadow-cyan-500/30
                        hover:scale-[1.02]
                        active:scale-[0.98]
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                        transition-all duration-200
                    "
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Source
                </button>
            </div>
        </form >
    );
}
