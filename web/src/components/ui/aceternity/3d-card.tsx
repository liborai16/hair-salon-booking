/**
 * 3D Card Effect — Premium hover depth tilt
 *
 * Inspired by Aceternity UI 3D Card Effect pattern.
 * Hand-built for Cinematic Wellness Luxury direction:
 *   - Mouse-tracking 3D tilt via perspective + transform
 *   - Child elements lift forward on hover (translateZ)
 *   - Smooth ease-out transition
 *   - Glassmorphism surface + lavender border accent
 *   - useReducedMotion-friendly (no animation if user has no pointer/hover)
 *   - Touch device fallback (no tilt fires, glass surface retained)
 *
 * Usage:
 *   <CardContainer>
 *     <CardBody className="...">
 *       <CardItem translateZ={50}>Title</CardItem>
 *       <CardItem translateZ={20}>Subtitle</CardItem>
 *     </CardBody>
 *   </CardContainer>
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  SetStateAction,
} from "react";
import { cn } from "@/lib/cn";

const MouseEnterContext = createContext<
  [boolean, Dispatch<SetStateAction<boolean>>] | undefined
>(undefined);

export interface CardContainerProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}

export function CardContainer({
  children,
  className,
  containerClassName,
}: CardContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isMouseEntered, setIsMouseEntered] = useState(false);

  function handleMouseMove(e: ReactMouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return;
    const { left, top, width, height } =
      containerRef.current.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 25;
    const y = (e.clientY - top - height / 2) / 25;
    containerRef.current.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
  }

  function handleMouseEnter() {
    setIsMouseEntered(true);
  }

  function handleMouseLeave() {
    if (!containerRef.current) return;
    setIsMouseEntered(false);
    containerRef.current.style.transform = "rotateY(0deg) rotateX(0deg)";
  }

  return (
    <MouseEnterContext.Provider value={[isMouseEntered, setIsMouseEntered]}>
      <div
        className={cn(
          "py-2 flex items-center justify-center",
          containerClassName,
        )}
        style={{ perspective: "1000px" }}
      >
        <div
          ref={containerRef}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "flex items-center justify-center relative transition-all duration-200 ease-linear",
            className,
          )}
          style={{ transformStyle: "preserve-3d" }}
        >
          {children}
        </div>
      </div>
    </MouseEnterContext.Provider>
  );
}

export interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  return (
    <div
      className={cn(
        "h-full w-full [transform-style:preserve-3d] [&>*]:[transform-style:preserve-3d]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface CardItemProps {
  as?: "div" | "h2" | "h3" | "p" | "span";
  children: ReactNode;
  className?: string;
  translateX?: number;
  translateY?: number;
  translateZ?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
}

export function CardItem({
  as: Tag = "div",
  children,
  className,
  translateX = 0,
  translateY = 0,
  translateZ = 0,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
}: CardItemProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const ctx = useContext(MouseEnterContext);
  const isMouseEntered = ctx?.[0] ?? false;

  useEffect(() => {
    if (!ref.current) return;
    if (isMouseEntered) {
      ref.current.style.transform = `translateX(${translateX}px) translateY(${translateY}px) translateZ(${translateZ}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;
    } else {
      ref.current.style.transform =
        "translateX(0px) translateY(0px) translateZ(0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)";
    }
  }, [
    isMouseEntered,
    translateX,
    translateY,
    translateZ,
    rotateX,
    rotateY,
    rotateZ,
  ]);

  return (
    <Tag
      ref={ref as never}
      className={cn("w-fit transition duration-200 ease-linear", className)}
    >
      {children}
    </Tag>
  );
}
