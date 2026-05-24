import { Link, Outlet } from "react-router-dom";

/**
 * Shared shell: top nav + main slot + footer. Mobile-first, modern luxe
 * theme — white surface, charcoal text, champagne accent on hover.
 */
export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-fg">
      <header className="border-b border-hairline bg-bg sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-bg/85">
        <div className="container mx-auto max-w-6xl px-4 py-5 flex items-center justify-between">
          <Link
            to="/"
            className="font-display text-2xl font-medium tracking-tight"
          >
            Salon Krásná
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              to="/book"
              className="inline-flex items-center px-3 min-h-[44px] rounded-md hover:text-accent-strong transition"
            >
              Rezervovat
            </Link>
            <Link
              to="/admin"
              className="inline-flex items-center px-3 min-h-[44px] rounded-md text-muted hover:text-fg transition"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>
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
