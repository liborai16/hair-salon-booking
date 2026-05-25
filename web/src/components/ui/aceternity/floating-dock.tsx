/**
 * Floating Dock — Premium sticky navigation
 *
 * Inspired by Aceternity UI Floating Dock pattern.
 * Hand-built for Cinematic Wellness Luxury direction:
 *   - Mobile: bottom-center compact icon dock (thumb zone)
 *   - Desktop: top-center horizontal pill with labels
 *   - Glassmorphism + lavender accent (Phase 8.1 tokens)
 *   - Framer Motion hover scale with spring
 *   - useReducedMotion accessibility
 *   - Active route detection via react-router useLocation
 *
 * Usage:
 *   <FloatingDock items={[
 *     { title: "Domů", href: "/", icon: <IconHome /> },
 *     { title: "Rezervovat", href: "/rezervace", icon: <IconCalendar /> },
 *   ]} />
 */
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/cn";

export interface FloatingDockItem {
  title: string;
  href: string;
  icon?: ReactNode;
}

export interface FloatingDockProps {
  items: FloatingDockItem[];
  className?: string;
}

export default function FloatingDock({ items, className }: FloatingDockProps) {
  const reduceMotion = useReducedMotion();
  const location = useLocation();
  const isActive = (href: string) => location.pathname === href;

  return (
    <nav
      aria-label="Hlavní navigace"
      className={cn(
        "fixed bottom-6 md:top-6 md:bottom-auto left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-1",
        "px-3 md:px-4 py-2",
        "rounded-full",
        "bg-white/[0.04] backdrop-blur-xl",
        "border border-white/[0.08]",
        "shadow-[0_10px_40px_rgba(0,0,0,0.3)]",
        className,
      )}
    >
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <motion.div
            key={item.href}
            whileHover={reduceMotion ? undefined : { scale: 1.15 }}
            whileTap={reduceMotion ? undefined : { scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <Link to={item.href} aria-current={active ? "page" : undefined}>
              <div
                className={cn(
                  "flex items-center gap-2",
                  "px-3 md:px-4 py-2 rounded-full",
                  "transition-colors duration-200",
                  active
                    ? "bg-[var(--color-accent)]/20 text-white ring-1 ring-[var(--color-accent)]/40 shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                    : "text-white/60 hover:text-white",
                )}
              >
                {item.icon && (
                  <span className="w-5 h-5 flex items-center justify-center">
                    {item.icon}
                  </span>
                )}
                <span className="hidden md:inline text-sm font-medium">
                  {item.title}
                </span>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </nav>
  );
}
