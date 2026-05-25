/**
 * Background Gradient Animation — Subtle blob mesh atmosphere
 *
 * Inspired by Aceternity UI Background Gradient Animation pattern.
 * Hand-built for Cinematic Wellness Luxury direction:
 *   - 4 animated colored blobs (lavender, violet, pink, amber)
 *   - SVG goo filter for smooth blob blending
 *   - Lower opacity (60-70%) per blob for SUBTLE feel
 *   - Slow 30-40s organic motion cycles
 *   - Optional mouse-follow interactive pointer blob (default OFF)
 *   - mix-blend-mode hard-light for atmospheric blending
 *   - useReducedMotion via CSS media query (in index.css)
 *
 * Phase 8.3.C.3 refactor:
 *   - Animation values held in useRef (NOT useState) — no re-render per frame
 *   - RAF effect deps reduced to [interactive] only — no cleanup/reinit churn
 *   - Mouse tracking uses window.addEventListener — works through child content
 *     z-stacking (cursor over H1/CTA still moves the pointer blob)
 *
 * Usage:
 *   <BackgroundGradientAnimation />
 *   <BackgroundGradientAnimation interactive />
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface BackgroundGradientAnimationProps {
  containerClassName?: string;
  className?: string;
  interactive?: boolean;
  children?: ReactNode;
}

export default function BackgroundGradientAnimation({
  containerClassName,
  className,
  interactive = false,
  children,
}: BackgroundGradientAnimationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const interactiveRef = useRef<HTMLDivElement | null>(null);

  // Refs (not state) for animation values — avoids re-render churn per frame.
  const curX = useRef(0);
  const curY = useRef(0);
  const tgX = useRef(0);
  const tgY = useRef(0);

  const [isSafari, setIsSafari] = useState(false);

  // Window-level mouse tracking — fires even when cursor is over z-stacked children.
  useEffect(() => {
    if (!interactive) return;

    function handleMove(e: MouseEvent) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        tgX.current = e.clientX - rect.left;
        tgY.current = e.clientY - rect.top;
      }
    }

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [interactive]);

  // Single self-scheduling RAF loop — refs mean no React re-renders per frame.
  useEffect(() => {
    if (!interactive) return;

    let raf: number;
    function loop() {
      if (interactiveRef.current) {
        curX.current += (tgX.current - curX.current) / 20;
        curY.current += (tgY.current - curY.current) / 20;
        interactiveRef.current.style.transform = `translate(${Math.round(curX.current)}px, ${Math.round(curY.current)}px)`;
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [interactive]);

  useEffect(() => {
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "h-full w-full absolute inset-0 overflow-hidden",
        "bg-[linear-gradient(40deg,var(--gradient-bg-start),var(--gradient-bg-end))]",
        containerClassName,
      )}
    >
      <svg className="hidden">
        <defs>
          <filter id="blurMe">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {children && <div className={cn("relative z-10", className)}>{children}</div>}

      <div
        className={cn(
          "gradients-container absolute inset-0 h-full w-full",
          isSafari ? "blur-2xl" : "[filter:url(#blurMe)_blur(40px)]",
        )}
      >
        <div
          className={cn(
            "absolute [background:radial-gradient(circle_at_center,_rgba(var(--gradient-first-color),0.6)_0,_rgba(var(--gradient-first-color),0)_50%)_no-repeat]",
            "[mix-blend-mode:var(--gradient-blending)]",
            "w-[var(--gradient-size)] h-[var(--gradient-size)]",
            "top-[calc(50%-var(--gradient-size)/2)] left-[calc(50%-var(--gradient-size)/2)]",
            "[transform-origin:center_center]",
            "gradient-animate-first",
            "opacity-70",
          )}
        />
        <div
          className={cn(
            "absolute [background:radial-gradient(circle_at_center,_rgba(var(--gradient-second-color),0.6)_0,_rgba(var(--gradient-second-color),0)_50%)_no-repeat]",
            "[mix-blend-mode:var(--gradient-blending)]",
            "w-[var(--gradient-size)] h-[var(--gradient-size)]",
            "top-[calc(50%-var(--gradient-size)/2)] left-[calc(50%-var(--gradient-size)/2)]",
            "[transform-origin:calc(50%-400px)]",
            "gradient-animate-second",
            "opacity-70",
          )}
        />
        <div
          className={cn(
            "absolute [background:radial-gradient(circle_at_center,_rgba(var(--gradient-third-color),0.6)_0,_rgba(var(--gradient-third-color),0)_50%)_no-repeat]",
            "[mix-blend-mode:var(--gradient-blending)]",
            "w-[var(--gradient-size)] h-[var(--gradient-size)]",
            "top-[calc(50%-var(--gradient-size)/2)] left-[calc(50%-var(--gradient-size)/2)]",
            "[transform-origin:calc(50%+400px)]",
            "gradient-animate-third",
            "opacity-70",
          )}
        />
        <div
          className={cn(
            "absolute [background:radial-gradient(circle_at_center,_rgba(var(--gradient-fourth-color),0.5)_0,_rgba(var(--gradient-fourth-color),0)_50%)_no-repeat]",
            "[mix-blend-mode:var(--gradient-blending)]",
            "w-[var(--gradient-size)] h-[var(--gradient-size)]",
            "top-[calc(50%-var(--gradient-size)/2)] left-[calc(50%-var(--gradient-size)/2)]",
            "[transform-origin:calc(50%-200px)]",
            "gradient-animate-fourth",
            "opacity-70",
          )}
        />
        {interactive && (
          <div
            ref={interactiveRef}
            className={cn(
              "absolute [background:radial-gradient(circle_at_center,_rgba(var(--gradient-pointer-color),0.7)_0,_rgba(var(--gradient-pointer-color),0)_50%)_no-repeat]",
              "[mix-blend-mode:var(--gradient-blending)] w-full h-full -top-1/2 -left-1/2",
              "opacity-80",
            )}
          />
        )}
      </div>
    </div>
  );
}
