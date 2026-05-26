import { Link, Outlet } from "react-router-dom";
import PremiumNav from "@/components/ui/PremiumNav";

/**
 * Shared shell: PremiumNav + main slot + footer (always shown).
 *
 * PremiumNav (floating glass pill, top-center) replaces former FloatingDock
 * + per-Landing SecondaryNav. It owns auth-awareness internally.
 */
export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-fg">
      <PremiumNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-white/[0.06] bg-black/40 backdrop-blur-md">
          <div className="container mx-auto max-w-7xl px-6 md:px-12 py-6 md:py-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-12 mb-6 md:mb-12">
              {/* Brand — spans 2 cols on desktop */}
              <div className="col-span-2">
                <div className="font-display text-xl md:text-2xl font-medium tracking-tight mb-2 md:mb-3">
                  Salon Krásná
                </div>
                <p className="text-white/50 text-sm md:text-base leading-relaxed max-w-sm mb-0">
                  Vlasy, kterým budete věřit.
                </p>
              </div>

              {/* Kontakt */}
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3 md:mb-4">
                  Kontakt
                </div>
                <ul className="space-y-1.5 text-sm text-white/60">
                  <li>Náměstí Míru 5, 120 00 Praha 2</li>
                  <li className="pt-1">
                    <a
                      href="tel:+420222333444"
                      className="hover:text-white transition-colors"
                    >
                      +420 222 333 444
                    </a>
                  </li>
                  <li>
                    <a
                      href="mailto:studio@salon.cz"
                      className="hover:text-white transition-colors"
                    >
                      studio@salon.cz
                    </a>
                  </li>
                </ul>
              </div>

              {/* Rychlé odkazy */}
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3 md:mb-4">
                  Rychlé odkazy
                </div>
                <ul className="space-y-1.5 text-sm">
                  <li>
                    <Link
                      to="/book"
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      Rezervace
                    </Link>
                  </li>
                  <li>
                    <a
                      href="/#cenik"
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      Ceník
                    </a>
                  </li>
                  <li>
                    <a
                      href="/#kontakt"
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      Kontakt
                    </a>
                  </li>
                  <li>
                    <Link
                      to="/admin"
                      className="text-white/40 hover:text-white/70 transition-colors text-xs"
                    >
                      Pro zaměstnance
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-5 md:pt-8 border-t border-white/[0.06] flex flex-col md:flex-row justify-between gap-2 md:gap-4 text-xs text-white/30">
              <div>
                © {new Date().getFullYear()} Salon Krásná. Všechna práva
                vyhrazena.
              </div>
              <div>Mapa: OpenStreetMap</div>
            </div>
          </div>
        </footer>
    </div>
  );
}
