/**
 * Spotlight — Hero atmosphere component
 *
 * Inspired by Aceternity UI "Spotlight (new)" pattern.
 * Hand-built for Cinematic Wellness Luxury direction:
 *   - Tailwind 4 native (no v3 config files)
 *   - Phase 8.1 token palette (lavender/violet/pink accents)
 *   - framer-motion for fade + drift
 *   - useReducedMotion accessibility
 *
 * Usage:
 *   <Spotlight />
 *   <Spotlight fill="lavender" position="left" />
 */
import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

export interface SpotlightProps {
  className?: string;
  fill?: "lavender" | "violet" | "pink" | "white";
  position?: "left" | "right" | "center";
  /** Fade-in duration in seconds (also half of the drift cycle). Default 7. */
  duration?: number;
}

const FILL_MAP = {
  lavender: "rgba(184, 161, 245, 0.4)",
  violet: "rgba(139, 92, 246, 0.35)",
  pink: "rgba(236, 72, 153, 0.30)",
  white: "rgba(255, 255, 255, 0.21)",
} as const;

const POSITION_MAP = {
  left: "top-[-40%] left-[-10%] -rotate-45",
  right: "top-[-40%] right-[-10%] rotate-45",
  center: "top-[-30%] left-1/2 -translate-x-1/2",
} as const;

export default function Spotlight({
  className,
  fill = "lavender",
  position = "left",
  duration = 7,
}: SpotlightProps) {
  const reduceMotion = useReducedMotion();
  const id = useId();
  const fillColor = FILL_MAP[fill];

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-0 h-screen w-[150vw] mix-blend-screen",
        POSITION_MAP[position],
        className,
      )}
    >
      <motion.svg
        viewBox="0 0 3787 2842"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        initial={
          reduceMotion
            ? { opacity: 1, scale: 1 }
            : { opacity: 0, scale: 0.5 }
        }
        animate={
          reduceMotion
            ? undefined
            : {
                opacity: 1,
                scale: 1,
                x: [-50, 50, -50],
              }
        }
        transition={
          reduceMotion
            ? undefined
            : {
                opacity: { duration, ease: "easeInOut" },
                scale: { duration, ease: "easeInOut" },
                x: {
                  duration: duration * 2,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                },
              }
        }
        style={{ willChange: "transform, opacity" }}
      >
        <g filter={`url(#outer-${id})`}>
          <ellipse
            cx="1924.71"
            cy="273.501"
            rx="1924.71"
            ry="273.501"
            transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
            fill={fillColor}
          />
        </g>
        <g filter={`url(#inner-${id})`}>
          <ellipse
            cx="1924.71"
            cy="273.501"
            rx="1924.71"
            ry="273.501"
            transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
            fill={fillColor}
          />
        </g>
        <defs>
          <filter
            id={`outer-${id}`}
            x="0"
            y="0"
            width="100%"
            height="100%"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="150" />
          </filter>
          <filter
            id={`inner-${id}`}
            x="0"
            y="0"
            width="100%"
            height="100%"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="80" />
          </filter>
        </defs>
      </motion.svg>
    </div>
  );
}
