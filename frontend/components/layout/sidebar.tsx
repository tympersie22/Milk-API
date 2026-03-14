"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { useAuth } from "../../context/auth-context";
import {
  IconHome,
  IconSearch,
  IconFileText,
  IconSettings,
  IconLogOut,
  IconMap,
  IconShield,
  IconColumns,
  IconUser,
  IconCrosshair,
} from "../ui/icons";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: IconHome },
  { href: "/properties", label: "Properties", icon: IconSearch },
  { href: "/identify", label: "Identify", icon: IconCrosshair },
  { href: "/compare", label: "Compare", icon: IconColumns },
  { href: "/reports", label: "Reports", icon: IconFileText },
  { href: "/profile", label: "Profile", icon: IconUser },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { email, name, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={cn("sidebar", open && "sidebar-open")} role="navigation" aria-label="Main navigation">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <IconMap size={20} />
          </div>
          <div>
            <div className="sidebar-logo-text">Milki</div>
            <div className="sidebar-logo-sub">Property Intelligence</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-nav-label">Menu</div>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("sidebar-nav-item", active && "sidebar-nav-active")}
                onClick={onClose}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom user section */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {(name || email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="sidebar-user-name truncate">{name || "User"}</div>
              <div className="sidebar-user-email truncate">{email || "—"}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={logout} title="Logout">
            <IconLogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
