import { EnvironmentProvider } from "../../context/EnvironmentContext";
import Shell from "../../components/layout/Shell";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <EnvironmentProvider>
            <Shell>{children}</Shell>
        </EnvironmentProvider>
    );
}
