import { fetchFromBackend } from "../../../lib/backend";
import { ListSessions } from "./ListSessions";

export default async function HistoryPage() {
    let sessions = [];
    try {
        sessions = await fetchFromBackend("/sessions/");
    } catch (e) {
        console.error("Failed to fetch sessions", e);
    }

    return (
        <div className="h-full flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white mb-2">Session History</h1>
                <p className="text-slate-400">View and manage your past conversations.</p>
            </div>

            <div className="flex-1 overflow-y-auto">
                <ListSessions initialSessions={sessions} />
            </div>
        </div>
    );
}
