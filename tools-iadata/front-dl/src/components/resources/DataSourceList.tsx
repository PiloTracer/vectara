"use client";

import React, { useState, useCallback, useEffect } from "react";
import { DataSource, deleteSource, ingestSource, initGoogleOAuth, initMicrosoftOAuth, getOAuthStatus, disconnectOAuth, OAuthStatus } from "../../actions/resources";
import { Trash2, Loader2, Database, Folder, Globe, ExternalLink, RefreshCw, CheckCircle, XCircle, Cloud, Building2, Link2, Unplug } from "lucide-react";
import { useJobStatus } from "../../hooks/useJobStatus";

// --- Sub-Components ---

interface JobStatusIndicatorProps {
    sourceId: string;
    jobId: string | undefined;
    onComplete: () => void;
}

function JobStatusIndicator({ sourceId, jobId, onComplete }: JobStatusIndicatorProps) {
    const { job, isPolling } = useJobStatus(jobId || null, {
        onComplete: () => onComplete(),
        onError: () => onComplete(),
    });

    if (!job && !isPolling) {
        // Idle state, nothing to show or handled by parent logic
        return null;
    }

    const status = job?.status || "PENDING";
    const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
        PENDING: { color: "yellow", label: "Queued", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
        RUNNING: { color: "blue", label: "Syncing", icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
        COMPLETED: { color: "emerald", label: "Done", icon: <CheckCircle className="w-3 h-3" /> },
        FAILED: { color: "red", label: "Failed", icon: <XCircle className="w-3 h-3" /> },
    };

    const config = statusConfig[status] || statusConfig.PENDING;

    return (
        <div className={`flex items-center gap-2 text-${config.color}-400 bg-slate-950/50 px-2 py-1 rounded-lg border border-${config.color}-500/20`}>
            {config.icon}
            <span className="text-[10px] font-bold uppercase tracking-widest">
                {config.label}
            </span>
        </div>
    );
}

// --- Connection Status Component ---

interface ConnectionStatusProps {
    source: DataSource;
    onConnectCheck: (connected: boolean) => void;
}

function ConnectionStatus({ source, onConnectCheck }: ConnectionStatusProps) {
    const [status, setStatus] = useState<OAuthStatus | null>(null);
    const [loading, setLoading] = useState(false);

    // Use ref to avoid stale closures and prevent infinite loops
    const onConnectCheckRef = React.useRef(onConnectCheck);
    onConnectCheckRef.current = onConnectCheck;

    useEffect(() => {
        if (source.type !== "GOOGLE_DRIVE" && source.type !== "SHAREPOINT") return;

        let isMounted = true;
        setLoading(true);

        getOAuthStatus(source.id)
            .then((res) => {
                if (isMounted) {
                    setStatus(res);
                    onConnectCheckRef.current(res.connected);
                }
            })
            .catch((e) => {
                console.error(e);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [source.id, source.type]); // Only re-run when source changes

    if (source.type !== "GOOGLE_DRIVE" && source.type !== "SHAREPOINT") return null;

    if (loading && !status) return <Loader2 className="w-3 h-3 animate-spin text-slate-500" />;

    if (status?.connected) {
        return (
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                <Link2 className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Connected</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
            <Unplug className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Disconnected</span>
        </div>
    );
}

// --- Main Component ---

interface DataSourceListProps {
    sources: DataSource[];
    onRefresh: () => void;
}

export function DataSourceList({ sources, onRefresh }: DataSourceListProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [activeJobs, setActiveJobs] = useState<Record<string, string>>({}); // sourceId -> jobId
    const [connectionStates, setConnectionStates] = useState<Record<string, boolean>>({}); // sourceId -> connected

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this source?")) return;
        setDeletingId(id);
        try {
            await deleteSource(id);
            onRefresh();
        } catch (err) {
            console.error("Failed to delete source:", err);
            alert("Failed to delete source");
        } finally {
            setDeletingId(null);
        }
    };

    const handleSync = async (sourceId: string) => {
        try {
            const result = await ingestSource(sourceId);
            setActiveJobs(prev => ({ ...prev, [sourceId]: result.job_id }));
        } catch (err) {
            console.error("Failed to start ingestion:", err);
            alert("Failed to start ingestion");
        }
    };

    const handleConnect = async (source: DataSource) => {
        try {
            let res;
            if (source.type === "GOOGLE_DRIVE") {
                res = await initGoogleOAuth(source.id, window.location.href);
            } else if (source.type === "SHAREPOINT") {
                res = await initMicrosoftOAuth(source.id, window.location.href);
            }

            if (res?.auth_url) {
                window.location.href = res.auth_url;
            }
        } catch (err) {
            console.error("Failed to init OAuth:", err);
            alert("Failed to initialize connection");
        }
    };

    const handleDisconnect = async (sourceId: string) => {
        if (!confirm("Revoke connection?")) return;
        await disconnectOAuth(sourceId);
        // Force refresh via a key change or parent refresh?
        // Ideally we just toggle state, but we rely on sub-component fetching.
        // Simple hack: window reload or parent refresh.
        window.location.reload();
    };

    const handleJobComplete = useCallback((sourceId: string) => {
        setActiveJobs(prev => {
            const next = { ...prev };
            delete next[sourceId];
            return next;
        });
        onRefresh();
    }, [onRefresh]);

    if (sources.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-8 bg-white/5 rounded-3xl border-2 border-dashed border-white/10 text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center mb-6 border border-white/10">
                    <Database className="w-10 h-10 text-white/20" />
                </div>
                <h3 className="text-xl font-medium text-white mb-2">
                    No Data Sources Configured
                </h3>
                <p className="text-white/40 text-sm max-w-sm leading-relaxed">
                    Add a local directory or web resource to start building your knowledge base.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sources.map((source) => {
                const isLocal = source.type === "LOCAL";
                const isDrive = source.type === "GOOGLE_DRIVE";
                const isSharePoint = source.type === "SHAREPOINT";

                let iconBg = "bg-slate-500/15 border-slate-500/30 text-slate-400";
                let badgeBg = "bg-slate-500/15 border-slate-500/30 text-slate-400";
                let Icon = Folder;

                if (isLocal) {
                    iconBg = "bg-amber-500/15 border-amber-500/30 text-amber-400";
                    badgeBg = "bg-amber-500/15 border-amber-500/30 text-amber-400";
                    Icon = Folder;
                } else if (source.type === "WEB") {
                    iconBg = "bg-blue-500/15 border-blue-500/30 text-blue-400";
                    badgeBg = "bg-blue-500/15 border-blue-500/30 text-blue-400";
                    Icon = Globe;
                } else if (isDrive) {
                    iconBg = "bg-green-500/15 border-green-500/30 text-green-400";
                    badgeBg = "bg-green-500/15 border-green-500/30 text-green-400";
                    Icon = Cloud;
                } else if (isSharePoint) {
                    iconBg = "bg-purple-500/15 border-purple-500/30 text-purple-400";
                    badgeBg = "bg-purple-500/15 border-purple-500/30 text-purple-400";
                    Icon = Building2;
                }

                const needsConnection = (isDrive || isSharePoint) && !connectionStates[source.id];
                const isConnected = (isDrive || isSharePoint) && connectionStates[source.id];

                return (
                    <div
                        key={source.id}
                        className="
                            group relative 
                            bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 
                            hover:border-slate-600 hover:bg-slate-800/80
                            hover:shadow-xl hover:shadow-black/30 
                            transition-all duration-300
                            flex flex-col gap-4
                        "
                    >
                        {/* Background Sheen Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />

                        {/* Card Content */}
                        <div className="relative z-10 flex flex-col h-full gap-4">

                            {/* Header */}
                            <div className="flex justify-between items-start">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${iconBg}`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`
                                        px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border
                                        ${badgeBg}
                                    `}>
                                        {source.type.replace("_", " ")}
                                    </span>
                                    <ConnectionStatus
                                        source={source}
                                        onConnectCheck={(connected) => setConnectionStates(prev => ({ ...prev, [source.id]: connected }))}
                                    />
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <h4 className="text-lg font-semibold text-slate-200 truncate" title={source.name}>
                                    {source.name}
                                </h4>
                            </div>

                            {/* Path */}
                            <div className="
                                flex items-center gap-2 
                                text-xs font-mono text-slate-300
                                bg-slate-950 border border-slate-700 rounded-xl px-3 py-3
                                overflow-hidden
                            ">
                                {!isLocal && <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />}
                                <span className="truncate">
                                    {isLocal ? source.config?.path : (source.config?.url || source.config?.site_url || source.config?.folder_id)}
                                </span>
                            </div>

                            {/* Footer */}
                            <div className="mt-auto pt-4 border-t border-slate-700/50 flex justify-between items-center min-h-[48px]">
                                <JobStatusIndicator
                                    sourceId={source.id}
                                    jobId={activeJobs[source.id]}
                                    onComplete={() => handleJobComplete(source.id)}
                                />

                                <div className="flex gap-2 ml-auto">
                                    {needsConnection ? (
                                        <button
                                            onClick={() => handleConnect(source)}
                                            className="
                                                px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20
                                                text-blue-400 text-xs font-bold uppercase tracking-wide
                                                hover:bg-blue-500/20 hover:border-blue-400
                                                transition-all
                                            "
                                        >
                                            Connect
                                        </button>
                                    ) : (
                                        /* Only show Sync button if connected or not a cloud source */
                                        <button
                                            onClick={() => handleSync(source.id)}
                                            disabled={!!activeJobs[source.id] || !!deletingId}
                                            className="
                                                p-2 rounded-lg 
                                                text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 
                                                transition-colors duration-200
                                                disabled:opacity-50 disabled:cursor-not-allowed
                                            "
                                            title="Sync Now"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${activeJobs[source.id] ? 'animate-spin' : ''}`} />
                                        </button>
                                    )}

                                    {isConnected && (
                                        <button
                                            onClick={() => handleDisconnect(source.id)}
                                            className="
                                                p-2 rounded-lg 
                                                text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 
                                                transition-colors duration-200
                                            "
                                            title="Disconnect Account"
                                        >
                                            <Unplug className="w-4 h-4" />
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleDelete(source.id)}
                                        disabled={!!deletingId || !!activeJobs[source.id]}
                                        className="
                                            p-2 rounded-lg 
                                            text-slate-600 hover:text-red-400 hover:bg-red-500/10 
                                            transition-colors duration-200
                                            disabled:opacity-50 disabled:cursor-not-allowed
                                        "
                                        title="Delete Source"
                                    >
                                        {deletingId === source.id
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : <Trash2 className="w-4 h-4" />
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
