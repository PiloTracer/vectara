"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"

export default function LoginButton() {
    const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")

    useEffect(() => {
        fetch("/api/auth/check")
            .then(res => {
                if (res.ok) setStatus("ok")
                else setStatus("error")
            })
            .catch(() => setStatus("error"))
    }, [])

    if (status === "loading") {
        return <div style={{ color: "#94a3b8" }}>Checking Auth Service...</div>
    }

    if (status === "error") {
        return (
            <div style={{ color: "#f87171", border: "1px solid #ef4444", padding: "1rem", borderRadius: "8px" }}>
                <p style={{ margin: 0, fontWeight: "bold" }}>⚠️ Authentication Unavailable</p>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>The SSO service (Keycloak) is unreachable.</p>
                <div style={{ marginTop: "1rem" }}>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: "0.5rem 1rem",
                            background: "#333",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer"
                        }}
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        )
    }

    return (
        <button
            onClick={() => signIn("keycloak", { callbackUrl: "/dashboard" })}
            style={{
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#fff',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}
        >
            Sign In with SSO
        </button>
    )
}
