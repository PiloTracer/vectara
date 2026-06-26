"use client";

import { useEffect, useState } from "react";
import { fetchFromBackend } from "../../../lib/backend";
import { FileText, Trash2, Search, Database, Loader2 } from "lucide-react";
import { useToast } from "../../../components/ui/Toast";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:18080";

interface DocumentInfo {
    path: string;
    chunk_count: number;
    source_type: string;
}

export default function KnowledgePage() {
    const { addToast } = useToast();
    const [documents, setDocuments] = useState<DocumentInfo[]>([]);
    const [stats, setStats] = useState<{ points_count: number; vectors_count: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [docsData, statsData] = await Promise.all([
                fetchFromBackend("/knowledge/"),
                fetchFromBackend("/knowledge/stats")
            ]);
            setDocuments(docsData);
            setStats(statsData);
        } catch (error) {
            console.error("Failed to load knowledge base:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDelete = async (path: string) => {
        try {
            const encodedPath = encodeURIComponent(path);
            const res = await fetch(`${API_BASE}/knowledge/${encodedPath}`, { method: "DELETE" });

            if (res.ok) {
                setDocuments(prev => prev.filter(d => d.path !== path));
                addToast("success", "Document deleted");
                if (stats) {
                    const doc = documents.find(d => d.path === path);
                    if (doc) {
                        setStats({ ...stats, points_count: stats.points_count - doc.chunk_count });
                    }
                }
            } else {
                addToast("error", "Failed to delete document");
            }
        } catch (e) {
            console.error("Delete failed", e);
            addToast("error", "Error deleting document");
        }
    };

    const filteredDocs = documents.filter(d =>
        d.path.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col">
            <div className="mb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Knowledge Base</h1>
                    <p className="text-slate-400">Manage ingested documents and check vector database status.</p>
                </div>

                {stats && (
                    <div className="flex gap-4 text-xs font-mono bg-slate-900 p-3 rounded-lg border border-slate-700">
                        <div className="flex flex-col items-center">
                            <span className="text-slate-500 uppercase">Documents</span>
                            <span className="text-white text-lg font-bold">{documents.length}</span>
                        </div>
                        <div className="w-px bg-slate-700"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-slate-500 uppercase">Total Chunks</span>
                            <span className="text-indigo-400 text-lg font-bold">{stats.points_count}</span>
                        </div>
                        <div className="w-px bg-slate-700"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-slate-500 uppercase">Status</span>
                            <span className={`text-lg font-bold ${stats.status === 'green' ? 'text-green-400' : 'text-yellow-400'}`}>
                                {stats.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                    type="text"
                    placeholder="Search documents..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                    aria-label="Search documents"
                />
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-900/30 rounded-xl border border-slate-800">
                <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase bg-slate-900/80 text-slate-500 sticky top-0 backdrop-blur-sm z-10">
                        <tr>
                            <th className="px-6 py-4 font-medium">Document Name</th>
                            <th className="px-6 py-4 font-medium text-center">Chunks</th>
                            <th className="px-6 py-4 font-medium text-center">Source</th>
                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    Loading documents...
                                </td>
                            </tr>
                        ) : filteredDocs.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    No documents found.
                                </td>
                            </tr>
                        ) : (
                            filteredDocs.map((doc, idx) => (
                                <tr key={idx} className="group hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded bg-indigo-500/10 text-indigo-400">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <span className="font-medium text-slate-300 truncate max-w-[300px]" title={doc.path}>
                                                {doc.path.split('/').pop()}
                                            </span>
                                            <span className="text-xs text-slate-600 truncate max-w-[200px]">
                                                {doc.path}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-800 text-xs font-medium text-slate-400 border border-slate-700">
                                            {doc.chunk_count}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">
                                            {doc.source_type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setDeleteTarget(doc.path)}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            aria-label={`Delete document ${doc.path}`}
                                            title="Delete Document"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
        <ConfirmDialog
            open={deleteTarget !== null}
            title="Delete Document"
            message={`Are you sure you want to delete "${deleteTarget}"? This will remove all its vectors.`}
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
