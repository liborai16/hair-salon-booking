/**
 * Secondary Navigation — Sticky glass pill nav for in-page sections
 *
 * Cinematic Wellness Luxury vocabulary:
 *   - Glassmorphism pill (matches Floating Dock vocabulary)
 *   - Sticky after Hero (top-4 on desktop, top-2 on mobile)
 *   - 5 anchor links: Domů (#) · O nás · Tým · Ceník · Kontakt
 *   - Smooth scroll behavior on anchor click
 *   - Active state via IntersectionObserver (lavender accent on visible section)
 *   - Horizontal scrollable on mobile (no wrap)
 *   - Hidden on non-Landing routes (controlled by parent)
 *
 * KNOWN ISSUE (Phase 8.3.E.1, fix in 8.3.E.1.1):
 *   The isScrolled flag listens to window scroll. Landing's snap container
 *   (h-screen overflow-y-scroll) catches the scroll instead, so window.scrollY
 *   stays at 0 and isScrolled never flips → nav stays hidden indefinitely.
 *   Active section tracking via IntersectionObserver works fine (uses viewport
 *   root, sections do translate through viewport during snap-scroll).
 */
import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { id: "home", label: "Domů", href: "#home" },
  { id: "o-nas", label: "O nás", href: "#o-nas" },
  { id: "tym", label: "Tým", href: "#tym" },
  { id: "cenik", label: "Ceník", href: "#cenik" },
  { id: "reference", label: "Reference", href: "#reference" },
  { id: "kontakt", label: "Kontakt", href: "#kontakt" },
];

export default function SecondaryNav() {
  const [activeId, setActiveId] = useState<string>("home");
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    // Show nav only after scrolling past hero (~80vh).
    // KNOWN: window scroll won't fire when Landing's snap container owns scroll.
    function handleScroll() {
      setIsScrolled(window.scrollY > window.innerHeight * 0.7);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Track active section via IntersectionObserver.
    const sections = NAV_ITEMS.map((item) =>
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
  }, []);

  function handleClick(
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
      aria-label="Navigace sekcí"
      className={cn(
        "fixed left-1/2 -translate-x-1/2 z-40 transition-all duration-500",
        isScrolled
          ? "top-20 md:top-24 opacity-100 pointer-events-auto"
          : "top-12 opacity-0 pointer-events-none",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 rounded-full",
          "bg-black/40 backdrop-blur-xl border border-white/[0.08]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
          "overflow-x-auto max-w-[90vw] no-scrollbar",
        )}
      >
        {NAV_ITEMS.map((item) => (
          <a
            key={item.id}
            href={item.href}
            onClick={(e) => handleClick(e, item.href)}
            aria-current={activeId === item.id ? "page" : undefined}
            className={cn(
              "px-3 py-1.5 text-xs md:text-sm tracking-wide rounded-full whitespace-nowrap transition-all",
              activeId === item.id
                ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                : "text-white/60 hover:text-white/90",
            )}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
