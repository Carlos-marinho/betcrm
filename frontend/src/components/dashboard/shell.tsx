"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { clearToken } from "@/lib/auth";
import {
  LayoutDashboard,
  Users,
  Workflow,
  MessageSquare,
  FileText,
  Filter,
  BarChart3,
  Settings,
  Zap,
  LogOut,
  Radio,
  Ticket,
} from "lucide-react";
import { useEffect } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Análises", icon: BarChart3 },
  { href: "/profiles", label: "Perfis", icon: Users },
  { href: "/segments", label: "Segmentos", icon: Filter },
  { href: "/coupons", label: "Cupons", icon: Ticket },
  { href: "/flows", label: "Fluxos", icon: Workflow },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/messages", label: "Mensagens", icon: MessageSquare },
  { href: "/events", label: "Eventos", icon: Zap },
  { href: "/settings", label: "Configurações", icon: Settings },
];

function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function isFullScreenRoute(pathname: string) {
  return /^\/flows\/[^/]+$/.test(pathname);
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const prefetchNavRoutes = () => {
      for (const item of navItems) {
        if (item.href !== pathname) router.prefetch(item.href);
      }
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(prefetchNavRoutes, { timeout: 2000 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(prefetchNavRoutes, 250);
    return () => globalThis.clearTimeout(timeoutId);
  }, [pathname, router]);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  if (isFullScreenRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col shrink-0 border-r border-border bg-card">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Radio className="w-3.5 h-3.5 text-gold" />
            </div>
            <span className="font-display font-bold text-base tracking-tight">
              <span className="text-gold">Bet</span>
              <span className="text-foreground">CRM</span>
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                onMouseEnter={() => router.prefetch(item.href)}
                onFocus={() => router.prefetch(item.href)}
                className={cn(
                  "w-full group flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-gold/10 text-gold border border-gold/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-gold" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-border space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
          <p className="px-3 text-xs text-muted-foreground/50 font-data">v0.1.0</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div key={pathname} className="flex-1 min-h-0 flex flex-col w-full max-w-[1400px] mx-auto animate-page-in">
          {children}
        </div>
      </main>
    </div>
  );
}
