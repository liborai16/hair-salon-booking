import { Outlet } from "react-router-dom";
import { IconHome, IconCalendar, IconShield } from "@tabler/icons-react";
import FloatingDock from "@/components/ui/aceternity/floating-dock";
import type { FloatingDockItem } from "@/components/ui/aceternity/floating-dock";
import { useAuth } from "@/lib/auth";

/**
 * Shared shell: top nav + main slot + footer. Mobile-first, modern luxe
 * theme — white surface, charcoal text, champagne accent on hover.
 */
export function Layout() {
  const auth = useAuth();

  const dockItems: FloatingDockItem[] = [
    { title: "Domů", href: "/", icon: <IconHome stroke={1.5} /> },
    {
      title: "Rezervovat",
      href: "/book",
      icon: <IconCalendar stroke={1.5} />,
    },
  ];
  if (auth.status === "authenticated") {
    dockItems.push({
      title: "Admin",
      href: "/admin",
      icon: <IconShield stroke={1.5} />,
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-fg">
      <FloatingDock items={dockItems} />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-hairline bg-bg-soft mt-16">
        <div className="container mx-auto max-w-6xl px-4 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="font-display text-lg font-medium tracking-tight">
              Salon Krásná
            </div>
            <div className="text-xs text-muted mt-1">
              Kadeřnictví v Praze · případová studie
            </div>
          </div>
          <div className="label-mono">© 2026</div>
        </div>
      </footer>
    </div>
  );
}
