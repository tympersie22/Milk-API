"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "../../context/theme-context";
import { IconMenu, IconSun, IconMoon } from "../ui/icons";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/properties": "Properties",
  "/reports": "Reports",
  "/settings": "Settings",
};

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || "Milki";
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="topbar">
      <button className="topbar-menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
        <IconMenu size={20} />
      </button>
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? <IconMoon size={18} /> : <IconSun size={18} />}
        </button>
        <div className="topbar-env-badge">API v1</div>
      </div>
    </header>
  );
}
