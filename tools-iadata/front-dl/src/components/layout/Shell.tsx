import { auth } from "../../auth";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { redirect } from "next/navigation";

export default async function Shell({ children }: { children: React.ReactNode }) {
    const session = await auth();

    if (!session?.user) {
        redirect("/api/auth/signin"); // Or handling via middleware, but this is a safe fallback
    }

    return (
        <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#0f172a" }}>
            <Sidebar />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", marginLeft: "280px" }}>
                <Header user={session.user} />
                <main style={{ flex: 1, padding: "32px", overflowY: "auto" }}>
                    {children}
                </main>
            </div>
        </div>
    );
}
