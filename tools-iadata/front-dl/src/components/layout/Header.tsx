"use client";

import { signOut } from "../../auth"; // Import from auth config directly? No, auth.ts is server-side usually for signOut if using server actions.
// Using standard next-auth/react for client side actions is often easier, but we want to stick to the pattern.
// If auth.ts exports signOut, we can use it in a server action form wrapper.

interface HeaderProps {
    user?: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
        roles?: string[];
    };
}

export default function Header({ user }: HeaderProps) {
    // Determine primary role for badge
    const role = user?.roles?.includes('app-owner') ? 'Owner' :
        user?.roles?.includes('app-admin') ? 'Admin' : 'User';

    const badgeColor = role === 'Owner' ? '#a855f7' : role === 'Admin' ? '#38bdf8' : '#94a3b8';

    return (
        <header
            style={{
                height: "64px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                padding: "0 32px",
                backgroundColor: "rgba(15, 23, 42, 0.8)", // Semi-transparent
                backdropFilter: "blur(12px)",
                position: "sticky",
                top: 0,
                zIndex: 40,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "0.9rem", color: "#fff", fontWeight: 600 }}>{user?.name || "User"}</span>
                    <span style={{ fontSize: "0.7rem", color: "#000", backgroundColor: badgeColor, padding: "2px 8px", borderRadius: "12px", alignSelf: "flex-end", fontWeight: 700 }}>
                        {role}
                    </span>
                </div>

                <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "#334155",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid rgba(255,255,255,0.1)",
                    overflow: "hidden"
                }}>
                    {/* Placeholder Avatar */}
                    {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>

                {/* Simple SignOut Button for now */}
                <form action={async () => {
                    // This form needs to submit to a server action that calls signOut
                    // Since we are in a "use client" component, we can't import server actions directly easily without defining them in a separate file.
                    // However, standard form action works if passed from parent or if we use fetch to /api/auth/signout
                    window.location.href = "/api/auth/signout";
                }}>
                    <button type="submit" style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: "0.8rem", marginLeft: "12px" }} title="Sign Out">
                        ➜
                    </button>
                </form>
            </div>
        </header>
    );
}
