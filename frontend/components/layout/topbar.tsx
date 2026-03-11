"use client";

import { usePathname } from "next/navigation";
import { IconMenu } from "../ui/icons";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/properties": "Properties",
  "/reports": "Reports",
  "/settings": "Settings",
};

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || "Milki";

  return (
    <header className="topbar">
      <button className="topbar-menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
        <IconMenu size={20} />
      </button>
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">
        <div className="topbar-env-badge">API v1</div>
      </div>
    </header>
  );
}
