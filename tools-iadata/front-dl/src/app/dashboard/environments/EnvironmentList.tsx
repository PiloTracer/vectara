"use client";

import React, { useState } from "react";
import EnvironmentCard from "../../../components/dashboard/environments/EnvironmentCard";
import CreateEnvironmentModal from "../../../components/dashboard/environments/CreateEnvironmentModal";
import { Environment } from "../../../actions/environments";

interface EnvironmentListProps {
    initialEnvironments: Environment[];
}

export default function EnvironmentList({ initialEnvironments }: EnvironmentListProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>

                {/* Create New Card */}
                <div
                    onClick={() => setIsModalOpen(true)}
                    style={{
                        border: "2px dashed rgba(255,255,255,0.1)",
                        borderRadius: "16px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        minHeight: "200px",
                        color: "#64748b",
                        transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#38bdf8";
                        e.currentTarget.style.color = "#38bdf8";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                        e.currentTarget.style.color = "#64748b";
                    }}
                >
                    <span style={{ fontSize: "2rem", marginBottom: "8px" }}>+</span>
                    <span style={{ fontWeight: "600" }}>Create Environment</span>
                </div>

                {/* Existing Environments */}
                {initialEnvironments.map((env) => (
                    <EnvironmentCard key={env.id} env={env} />
                ))}
            </div>

            <CreateEnvironmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
}
