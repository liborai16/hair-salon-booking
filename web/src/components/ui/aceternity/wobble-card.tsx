/**
 * Wobble Card — Playful mouse-following tilt
 *
 * Inspired by Aceternity UI Wobble Card pattern.
 * Hand-built for Cinematic Wellness Luxury direction:
 *   - Subtle wobble/translate on mouse move
 *   - Reset on mouse leave
 *   - Glassmorphism + soft inner glow
 *   - For playful subkategorie (e.g. Dětský střih)
 *   - useReducedMotion-friendly (animation is mouse-driven only)
 *
 * Usage:
 *   <WobbleCard className="...">
 *     <h3>Dětský střih</h3>
 *   </WobbleCard>
 */
import { useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export interface WobbleCardProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}

export default function WobbleCard({
  children,
  className,
  containerClassName,
}: WobbleCardProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  function handleMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    const { clientX, clientY } = event;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clientX - (rect.left + rect.width / 2);
    const y = clientY - (rect.top + rect.height / 2);
    setMousePosition({ x, y });
  }

  return (
    <motion.section
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setMousePosition({ x: 0, y: 0 });
      }}
      style={{
        transform: isHovering
          ? `translate3d(${mousePosition.x * 0.08}px, ${mousePosition.y * 0.08}px, 0) scale3d(1, 1, 1)`
          : "translate3d(0px, 0px, 0) scale3d(1, 1, 1)",
        transition: "transform 0.1s ease-out",
      }}
      className={cn(
        "mx-auto relative rounded-2xl md:rounded-3xl overflow-hidden",
        "bg-white/[0.04] backdrop-blur-xl border border-white/[0.08]",
        "shadow-[0_20px_60px_rgba(0,0,0,0.3)]",
        "hover:bg-white/[0.06] hover:border-[var(--color-accent)]/30 transition-colors",
        containerClassName,
      )}
    >
      <motion.div
        style={{
          transform: isHovering
            ? `translate3d(${mousePosition.x * 0.04}px, ${mousePosition.y * 0.04}px, 0)`
            : "translate3d(0px, 0px, 0)",
          transition: "transform 0.1s ease-out",
        }}
        className={cn("relative z-10", className)}
      >
        {children}
      </motion.div>
    </motion.section>
  );
}
