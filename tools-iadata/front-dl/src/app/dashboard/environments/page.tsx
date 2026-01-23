import { getEnvironments } from "../../../actions/environments";
import EnvironmentList from "./EnvironmentList"; // Client wrapper

// This is a Server Component
export default async function EnvironmentsPage() {
    const environments = await getEnvironments();

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
                <div>
                    <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#f8fafc" }}>Environments</h1>
                    <p style={{ color: "#94a3b8", marginTop: "4px" }}>Manage your workspaces and contexts.</p>
                </div>
            </div>

            <EnvironmentList initialEnvironments={environments} />
        </div>
    );
}
