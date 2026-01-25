import { ChatInterface } from "../../components/chat/ChatInterface";

export default function DashboardPage() {
    return (
        <div className="h-full">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white mb-2">Chat</h1>
                <p className="text-slate-400">Interact with your documents using local AI.</p>
            </div>
            <ChatInterface />
        </div>
    );
}
