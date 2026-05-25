/**
 * PremiumNav — Unified floating glass-pill navigation
 *
 * Replaces FloatingDock + SecondaryNav with one nav that adapts to route:
 *   - On Landing (/): renders 6 anchor links + Rezervovat CTA (lavender pill)
 *     + Admin (if authenticated). Active state via IntersectionObserver.
 *   - On other routes (/book, /admin, /r/:token): renders Domů + Rezervovat
 *     + Admin (if authenticated). Active state via location.pathname.
 *
 * Cinematic Wellness Luxury vocabulary:
 *   - Floating pill (rounded-full), centered top
 *   - Glassmorphism (backdrop-blur-2xl, bg-black/40)
 *   - Soft border + ambient shadow + inset light
 *   - Always visible (not scroll-gated)
 *   - Mobile: horizontally scrollable (no-scrollbar utility)
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

  function handleAnchorClick(
    e: ReactMouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    e.preventDefault();
    const id = href.replace("#", "");
    const target = id === "home" ? document.body : document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <nav
      aria-label="Hlavní navigace"
      className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-50"
    >
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 rounded-full",
          "bg-black/40 backdrop-blur-2xl border border-white/[0.08]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]",
          "overflow-x-auto max-w-[95vw] no-scrollbar",
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
              className={cn(
                "px-4 py-1.5 text-xs md:text-sm tracking-wide rounded-full whitespace-nowrap transition-all duration-300",
                "bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent)]/90 font-medium",
              )}
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
  );
}
