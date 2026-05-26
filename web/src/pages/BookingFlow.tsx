import BackgroundGradientAnimation from "@/components/ui/aceternity/background-gradient-animation";
import { BookingShell } from "../booking/BookingShell";

/**
 * Public booking route shell.
 *
 * Phase 8.3.G.1: atmospheric gold backdrop (subtler than Landing — opacity-50
 * + interactive=false) sits fixed behind a z-10 content container. PremiumNav
 * nav-clearance padding preserved from Phase 8.3.E.9.
 */
export function BookingFlow() {
  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 opacity-50 pointer-events-none"
      >
        <BackgroundGradientAnimation
          interactive={false}
          containerClassName="h-full w-full"
        />
      </div>

      <div className="relative z-10 container mx-auto max-w-3xl px-4 pt-24 md:pt-32 pb-10 md:pb-14">
        <BookingShell />
      </div>
    </div>
  );
}
