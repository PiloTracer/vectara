"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, MessageSquare, ArrowRight, Calendar } from "lucide-react";

interface Session {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

const API_BASE = "http://localhost:18080";

export function ListSessions({ initialSessions }: { initialSessions: Session[] }) {
    const [sessions, setSessions] = useState<Session[]>(initialSessions);
    const router = useRouter();

    const deleteSession = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this session?")) return;

        try {
            const res = await fetch(`${API_BASE}/sessions/${id}`, { method: "DELETE" });
            if (res.ok) {
                setSessions(prev => prev.filter(s => s.id !== id));
                router.refresh();
            }
        } catch (error) {
            console.error("Failed to delete session", error);
        }
    };

    const openSession = (id: string) => {
        router.push(`/dashboard?session_id=${id}`);
    };

    // Format date nicely
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!sessions || sessions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 border border-dashed border-slate-700 rounded-xl bg-slate-900/50">
                <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                <p>No history yet.</p>
                <button
                    onClick={() => router.push('/dashboard')}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"
                >
                    Start a Chat
                </button>
            </div>
        );
    }

    return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map(session => (
                <div
                    key={session.id}
                    onClick={() => openSession(session.id)}
                    className="
                        group relative p-5 bg-slate-800/50 border border-slate-700 hover:border-indigo-500/50 
                        rounded-xl transition-all cursor-pointer hover:bg-slate-800 hover:shadow-lg hover:shadow-indigo-500/10
                    "
                >
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <button
                            onClick={(e) => deleteSession(e, session.id)}
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors z-10"
                            title="Delete Session"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <h3 className="font-semibold text-slate-200 mb-2 line-clamp-2 group-hover:text-indigo-300 transition-colors">
                        {session.title || "Untitled Session"}
                    </h3>

                    <div className="flex items-center text-xs text-slate-500 gap-4 mt-auto">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(session.updated_at || session.created_at)}
                        </span>
                    </div>

                    <div className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400">
                        <ArrowRight className="w-5 h-5" />
                    </div>
                </div>
            ))}
        </div>
    );
}
