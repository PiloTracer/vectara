"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, FileText, Loader2, StopCircle, AlertCircle } from 'lucide-react';
import { useEnvironment } from '../../context/EnvironmentContext';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sources?: Source[];
}

interface Source {
    id: string;
    score: number;
    metadata: {
        path: string;
        text: string;
        chunk_index?: number;
        [key: string]: any;
    };
}

const API_BASE = "http://localhost:18080"; // BFF or Direct

export function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sourceIds, setSourceIds] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { activeEnvironmentId, activeEnvironment } = useEnvironment();

    // Fetch source IDs for the active environment
    useEffect(() => {
        if (!activeEnvironmentId) {
            setSourceIds([]);
            return;
        }

        fetch(`${API_BASE}/resources/env/${activeEnvironmentId}/sources`)
            .then(res => res.json())
            .then(data => {
                // Handle both array response and wrapped response
                const sources = Array.isArray(data) ? data : [];
                const ids = sources.map((src: any) => src.id);
                setSourceIds(ids);
                console.log(`Loaded ${ids.length} source IDs for environment ${activeEnvironmentId}`);
            })
            .catch(err => {
                console.error("Failed to load sources for environment", err);
                setSourceIds([]);
            });
    }, [activeEnvironmentId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            // Prepare history (excluding sources to keep payload small)
            const history = messages.map(m => ({ role: m.role, content: m.content }));

            const res = await fetch(`${API_BASE}/chat/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMsg.content,
                    history: history,
                    use_rag: true,
                    filter: sourceIds.length > 0 ? { source_ids: sourceIds } : null
                })
            });

            if (!res.ok) throw new Error("Failed to send message");

            const data = await res.json();

            const assistantMsg: Message = {
                role: 'assistant',
                content: data.response,
                sources: data.sources
            };

            setMessages(prev => [...prev, assistantMsg]);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Sorry, I encountered an error extracting information."
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] bg-slate-900/50 rounded-3xl border border-slate-700/50 overflow-hidden relative group">
            {/* Background Sheen */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

            {/* Header */}
            <div className="p-4 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm z-10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Bot className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Data Lake Assistant</h3>
                    <p className="text-xs text-slate-400">Powered by Local LLM (Qwen2.5)</p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent z-10">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                        <Bot className="w-16 h-16 mb-4" />
                        <p>Ask a question to start exploring your data sources.</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0 mt-1">
                                <Bot className="w-4 h-4" />
                            </div>
                        )}

                        <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-sm'
                            }`}>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>

                            {/* Citations */}
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-white/10">
                                    <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                                        <FileText className="w-3 h-3" /> Sources
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {msg.sources.map((src, i) => (
                                            <div key={i} className="group/src relative">
                                                <div
                                                    className="
                             text-[10px] px-2 py-1 rounded bg-black/20 border border-white/10 
                             text-slate-400 truncate max-w-[150px] cursor-help
                             hover:bg-indigo-500/20 hover:text-indigo-300 hover:border-indigo-500/30 transition-colors
                           "
                                                    title={src.metadata.text} // Simple tooltip for now
                                                >
                                                    {src.metadata.path.split('/').pop() || 'Unknown'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0 mt-1">
                                <User className="w-4 h-4" />
                            </div>
                        )}
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3 justify-start animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                            <span className="text-xs text-slate-400 font-medium">Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-700/50 bg-slate-900/80 backdrop-blur-sm z-10">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your documents..."
                        className="
                 w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 pl-4 pr-12
                 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50
                 transition-all
               "
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="
                 absolute right-2 top-2 p-1.5 rounded-lg
                 bg-indigo-500 text-white 
                 hover:bg-indigo-400 disabled:opacity-50 disabled:hover:bg-indigo-500
                 transition-colors
               "
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </form>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-slate-500">
                        AI can make mistakes. Please verify important information.
                    </p>
                </div>
            </div>
        </div>
    );
}
