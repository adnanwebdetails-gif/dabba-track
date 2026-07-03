"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, LayoutDashboard, PlusCircle, CheckSquare } from "lucide-react";

export function Navigation() {
  const pathname = usePathname();

  if (pathname === "/login") {
    return null;
  }

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/add-parcels", label: "Add Parcels", icon: PlusCircle },
    { href: "/reconcile", label: "Reconcile", icon: CheckSquare },
  ];

  return (
    <header className="border-b border-text-ink/10 bg-card-bg sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded bg-terracotta p-1.5 text-card-bg">
              <Package size={22} />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-text-ink">
              DabbaTrack
            </span>
          </div>

          <nav className="flex space-x-1 sm:space-x-4">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? "bg-terracotta text-card-bg shadow-sm"
                      : "text-text-ink/75 hover:bg-kraft-bg hover:text-text-ink"
                  }`}
                >
                  <Icon size={16} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
