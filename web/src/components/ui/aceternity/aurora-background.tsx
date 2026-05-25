/**
 * Aurora Background — Multi-color atmospheric swirl
 *
 * Inspired by Aceternity UI Aurora Background pattern.
 * Hand-built for Cinematic Wellness Luxury direction:
 *   - CSS-only gradient mesh (no SVG, no framer-motion)
 *   - 4-color cinematic palette: lavender, violet, pink, amber
 *   - 30-50% alpha saturation (visible per user vibe lock)
 *   - Slow 60s position swirl (no comet streaks)
 *   - Optional radial mask (showRadialMask prop)
 *   - mix-blend-mode for atmospheric blending on dark base
 *   - pointer-events-none, aria-hidden, prefers-reduced-motion-safe (CSS media query in index.css)
 *
 * Different from Phase 8.2 reverted Aurora (blob-based) — uses CSS gradient
 * mesh approach per Aceternity official pattern.
 *
 * Usage:
 *   <AuroraBackground />
 *   <AuroraBackground showRadialMask />
 *   <AuroraBackground className="opacity-70" />
 */
import { cn } from "@/lib/cn";

export interface AuroraBackgroundProps {
  className?: string;
  /** Apply radial ellipse mask to concentrate aurora at top-right corner. Default false (full bleed). */
  showRadialMask?: boolean;
}

export default function AuroraBackground({
  className,
  showRadialMask = false,
}: AuroraBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden z-0",
        className,
      )}
    >
      <div
        className={cn(
          "absolute -inset-[10px] opacity-50",
          "[background-image:var(--aurora-mask-gradient),var(--aurora-cinematic)]",
          "[background-size:300%,_200%]",
          "[background-position:50%_50%,50%_50%]",
          "blur-[10px]",
          "filter",
          "will-change-transform",
          "animate-aurora",
          "[mix-blend-mode:plus-lighter]",
          showRadialMask &&
            "[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]",
        )}
      />
    </div>
  );
}
