"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarItemProps {
    href: string;
    icon?: React.ReactNode;
    label: string;
}

export default function SidebarItem({ href, icon, label }: SidebarItemProps) {
    const pathname = usePathname();
    const isActive = pathname === href || pathname.startsWith(`${href}/`);

    return (
        <Link
            href={href}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 16px",
                textDecoration: "none",
                color: isActive ? "#fff" : "#94a3b8",
                backgroundColor: isActive ? "rgba(255, 255, 255, 0.1)" : "transparent",
                borderRadius: "8px",
                transition: "all 0.2s ease",
                fontSize: "0.95rem",
                fontWeight: isActive ? 600 : 400,
                borderLeft: isActive ? "3px solid #38bdf8" : "3px solid transparent",
            }}
        >
            {icon && <span style={{ fontSize: "1.2rem", display: "flex" }}>{icon}</span>}
            <span>{label}</span>
        </Link>
    );
}
