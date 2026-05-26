/**
 * PremiumNav — Unified floating glass-pill navigation
 *
 * Two-layout responsive split:
 *   - Mobile (<md): top bar with hamburger (Landing) or back-to-Domů (other
 *     routes) + Rezervovat CTA pill. Hamburger opens full-screen drawer
 *     overlay with all 6 anchor links + close button + bottom Rezervovat CTA.
 *     Body scroll locked while drawer is open.
 *   - Desktop (md+): single floating pill, anchor links + Rezervovat CTA +
 *     Admin (when authenticated). Active state via IntersectionObserver on
 *     Landing.
 *
 * Cinematic Wellness Luxury vocabulary:
 *   - Glassmorphism (backdrop-blur-2xl, bg-black/40 / black/95 for drawer)
 *   - Soft border + ambient shadow + inset light
 *   - Lavender Rezervovat CTA
 */
import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";

const LANDING_ANCHORS = [
  { id: "home", label: "Domů", href: "#home" },
  { id: "o-nas", label: "O nás", href: "#o-nas" },
  { id: "tym", label: "Tým", href: "#tym" },
  { id: "cenik", label: "Ceník", href: "#cenik" },
  { id: "reference", label: "Reference", href: "#reference" },
  { id: "kontakt", label: "Kontakt", href: "#kontakt" },
];

export default function PremiumNav() {
  const location = useLocation();
  const isLanding = location.pathname === "/";
  const auth = useAuth();
  const isAuth = auth?.status === "authenticated";
  const [activeId, setActiveId] = useState<string>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isLanding) return;
    const sections = LANDING_ANCHORS.map((item) =>
      document.getElementById(item.id),
    ).filter(Boolean);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );

    sections.forEach((section) => section && observer.observe(section));
    return () => observer.disconnect();
  }, [isLanding]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  function handleAnchorClick(
    e: ReactMouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    e.preventDefault();
    setDrawerOpen(false);
    const id = href.replace("#", "");
    const target = id === "home" ? document.body : document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <>
      {/* MOBILE BAR — hamburger (Landing) or back-to-home (other) + Rezervovat CTA */}
      <div className="md:hidden fixed top-3 left-3 right-3 z-50 flex items-center justify-between gap-3">
        {isLanding ? (
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Otevřít menu"
            className="flex items-center justify-center w-11 h-11 rounded-full bg-black/40 backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-white"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        ) : (
          <Link
            to="/"
            className="flex items-center justify-center px-4 h-11 rounded-full bg-black/40 backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-white/80 text-sm"
          >
            ← Domů
          </Link>
        )}
        <Link
          to="/book"
          className="flex items-center justify-center px-5 h-11 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-black font-medium text-sm tracking-wide transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        >
          Rezervovat
        </Link>
      </div>

      {/* MOBILE DRAWER — full-screen overlay with anchors */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-black/95 backdrop-blur-2xl flex flex-col"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex justify-end p-4">
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Zavřít menu"
              className="flex items-center justify-center w-11 h-11 rounded-full bg-white/[0.06] border border-white/[0.08] text-white"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <nav
            aria-label="Hlavní navigace"
            className="flex-1 flex flex-col justify-center px-6"
          >
            <ul className="space-y-6">
              {LANDING_ANCHORS.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.href}
                    onClick={(e) => handleAnchorClick(e, item.href)}
                    aria-current={activeId === item.id ? "page" : undefined}
                    className={cn(
                      "block font-display text-3xl font-medium tracking-tight transition-colors",
                      activeId === item.id
                        ? "text-[var(--color-accent)]"
                        : "text-white/80 hover:text-white",
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            {isAuth && (
              <Link
                to="/admin"
                onClick={() => setDrawerOpen(false)}
                className="mt-12 text-white/40 text-sm tracking-wide"
              >
                Admin →
              </Link>
            )}
          </nav>

          <div className="p-6 pb-10">
            <Link
              to="/book"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center justify-center w-full h-14 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-black font-medium tracking-wide transition-all"
            >
              Rezervovat termín →
            </Link>
          </div>
        </div>
      )}

      {/* DESKTOP PILL — unchanged from Phase 8.3.E.7 visual, just hidden below md */}
      <nav
        aria-label="Hlavní navigace"
        className="hidden md:block fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-50"
      >
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded-full",
            "bg-black/40 backdrop-blur-2xl border border-white/[0.08]",
            "shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]",
          )}
        >
          {isLanding ? (
            <>
              {LANDING_ANCHORS.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => handleAnchorClick(e, item.href)}
                  aria-current={activeId === item.id ? "page" : undefined}
                  className={cn(
                    "px-3 md:px-4 py-1.5 text-xs md:text-sm tracking-wide rounded-full whitespace-nowrap transition-all duration-300",
                    activeId === item.id
                      ? "bg-white/[0.06] text-white"
                      : "text-white/60 hover:text-white/90 hover:bg-white/[0.04]",
                  )}
                >
                  {item.label}
                </a>
              ))}
              <div
                className="w-px h-5 bg-white/[0.08] mx-1"
                aria-hidden="true"
              />
              <Link
                to="/book"
                className="px-4 py-1.5 text-xs md:text-sm tracking-wide rounded-full whitespace-nowrap transition-all duration-300 bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent)]/90 font-medium"
              >
                Rezervovat
              </Link>
              {isAuth && (
                <Link
                  to="/admin"
                  className="px-3 py-1.5 text-xs tracking-wide rounded-full whitespace-nowrap transition-all duration-300 text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
                >
                  Admin
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                to="/"
                className="px-3 md:px-4 py-1.5 text-xs md:text-sm tracking-wide rounded-full whitespace-nowrap transition-all text-white/60 hover:text-white/90 hover:bg-white/[0.04]"
              >
                Domů
              </Link>
              <Link
                to="/book"
                aria-current={location.pathname === "/book" ? "page" : undefined}
                className={cn(
                  "px-4 py-1.5 text-xs md:text-sm tracking-wide rounded-full whitespace-nowrap transition-all",
                  location.pathname === "/book"
                    ? "bg-[var(--color-accent)] text-black font-medium"
                    : "bg-white/[0.06] text-white hover:bg-white/[0.10]",
                )}
              >
                Rezervovat
              </Link>
              {isAuth && (
                <Link
                  to="/admin"
                  aria-current={
                    location.pathname === "/admin" ? "page" : undefined
                  }
                  className={cn(
                    "px-3 py-1.5 text-xs tracking-wide rounded-full whitespace-nowrap transition-all",
                    location.pathname === "/admin"
                      ? "bg-white/[0.06] text-white"
                      : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]",
                  )}
                >
                  Admin
                </Link>
              )}
            </>
          )}
        </div>
      </nav>
    </>
  );
}
