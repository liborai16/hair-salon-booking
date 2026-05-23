import { Link, Outlet } from "react-router-dom";

/**
 * Shared shell: top nav + main slot + footer. Mobile-first (container caps
 * at ~max-w-5xl but flexes down). No design system polish yet — Tailwind
 * utilities only, neutral stone palette as placeholder.
 */
export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="container mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold tracking-tight">
            Salon Krásná
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/book" className="hover:text-stone-600">
              Rezervovat
            </Link>
            <Link to="/admin" className="text-stone-500 hover:text-stone-700">
              Admin
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-stone-200 bg-white">
        <div className="container mx-auto max-w-5xl px-4 py-4 text-xs text-stone-500">
          Případová studie · Hair Salon Booking
        </div>
      </footer>
    </div>
  );
}
