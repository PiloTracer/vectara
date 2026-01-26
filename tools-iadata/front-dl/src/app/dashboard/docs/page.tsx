"use client";

import { Book, Code, FileText, HelpCircle, Terminal } from "lucide-react";

export default function DocsPage() {
    return (
        <div className="max-w-4xl mx-auto pb-12">
            <div className="mb-10 text-center">
                <h1 className="text-3xl font-bold text-white mb-4">Documentation</h1>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                    Learn how to use your Local AI Data Lake, troubleshoot issues, and get the most out of your documents.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-indigo-500/50 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
                        <Book className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Getting Started</h2>
                    <p className="text-slate-400 mb-4">
                        New to the platform? Learn the basics of ingestion and chatting.
                    </p>
                    <ul className="space-y-2 text-sm text-slate-300">
                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Adding your first data source</li>
                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Asking questions to your PDF</li>
                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Understanding citations</li>
                    </ul>
                </div>

                <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-indigo-500/50 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
                        <Terminal className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Technical Guide</h2>
                    <p className="text-slate-400 mb-4">
                        Deep dive into the architecture and configuration.
                    </p>
                    <ul className="space-y-2 text-sm text-slate-300">
                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> RAG Pipeline Architecture</li>
                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Hybrid Search Explained</li>
                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> configuring Ollama models</li>
                    </ul>
                </div>
            </div>

            <div className="prose prose-invert prose-slate max-w-none">
                <section className="mb-12">
                    <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-2 border-b border-slate-800">
                        <HelpCircle className="w-6 h-6 text-indigo-400" />
                        Frequently Asked Questions
                    </h2>

                    <div className="space-y-6">
                        <div className="bg-slate-800/30 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-white mb-2">How does the search work?</h3>
                            <p className="text-slate-400 leading-relaxed">
                                We use a <strong>Hybrid Search</strong> approach. When you ask a question, we convert it into two types of vectors:
                                dense (semantic meaning) and sparse (keyword match). We search Qdrant for both, fuse the results using Reciprocal Rank Fusion (RRF),
                                and then re-rank the top candidates using a Cross-Encoder model for maximum precision.
                            </p>
                        </div>

                        <div className="bg-slate-800/30 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-white mb-2">Where is my data stored?</h3>
                            <p className="text-slate-400 leading-relaxed">
                                All data is stored <strong>locally</strong> on your machine.
                                - <strong>Vectors:</strong> Stored in the local Qdrant container volume.
                                - <strong>Chat History:</strong> Stored in the local PostgreSQL database.
                                - <strong>Documents:</strong> Remain in your original folders, accessed via the Bridge.
                            </p>
                        </div>

                        <div className="bg-slate-800/30 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-white mb-2">Why is ingestion slow?</h3>
                            <p className="text-slate-400 leading-relaxed">
                                Ingestion involves three heavy steps:
                                1. <strong>OCR/Text Extraction:</strong> Reading the PDF content.
                                2. <strong>Embedding:</strong> Generating 1024-dimension vectors for every paragraph.
                                3. <strong>Upserting:</strong> Writing to the vector database.
                                <br /><br />
                                If you have a GPU, ensure it is enabled in settings to speed this up significantly.
                            </p>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-2 border-b border-slate-800">
                        <Code className="w-6 h-6 text-indigo-400" />
                        API Reference
                    </h2>
                    <p className="text-slate-400 mb-4">
                        The backend exposes a full REST API for integrations. Access the interactive Swagger UI at:
                    </p>
                    <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm text-indigo-300">
                        http://localhost:18080/docs
                    </div>
                </section>
            </div>
        </div>
    );
}
