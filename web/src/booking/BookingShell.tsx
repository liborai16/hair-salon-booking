import { useReducer } from "react";
import {
  useSalonOverride,
  useServices,
  useStylists,
} from "./useBookingData";
import { bookingReducer, initialBookingState } from "./state";
import { ServiceStep } from "./steps/ServiceStep";
import { SlotStep } from "./steps/SlotStep";
import { CustomerStep } from "./steps/CustomerStep";
import { ConfirmStep } from "./steps/ConfirmStep";
import { SuccessStep } from "./steps/SuccessStep";
import { cn } from "@/lib/cn";

/**
 * Booking flow orchestrator — useReducer-driven state machine over 4 steps:
 * services → slot → customer → confirm → success.
 *
 * Public data (services / stylists / salonSettings) is loaded once at the
 * shell level and passed down; per-stylist availability inside SlotStep.
 *
 * `minLeadTimeMinutesOverride` prop — admin walk-in (Phase 3.3) passes 0
 * so the slot picker shows slots starting NOW. CF wrapper independently
 * sets minLeadTime=0 for staff callers (server authoritative), but the
 * UI must mirror so reachable slots actually render.
 */
export function BookingShell({
  minLeadTimeMinutesOverride,
}: { minLeadTimeMinutesOverride?: number } = {}) {
  const [state, dispatch] = useReducer(bookingReducer, initialBookingState);
  const { services, error: servicesError } = useServices();
  const { stylists, error: stylistsError } = useStylists();
  const override = useSalonOverride();

  if (servicesError || stylistsError) {
    return (
      <div className="text-sm text-danger bg-danger-soft border border-danger/20 rounded-md p-3">
        Chyba načítání: {servicesError ?? stylistsError}
      </div>
    );
  }

  if (!services || !stylists) {
    return <BookingLoadingSkeleton />;
  }

  const stepOrder = ["services", "slot", "customer", "confirm"] as const;
  const currentIdx = stepOrder.indexOf(state.step as typeof stepOrder[number]);
  const showProgress = state.step !== "success";

  return (
    <div>
      {showProgress && currentIdx >= 0 && (
        <StepProgress current={currentIdx} />
      )}
      {(() => {
        switch (state.step) {
          case "services":
            return (
              <ServiceStep
                services={services}
                selectedIds={state.selectedServiceIds}
                serviceLengths={state.serviceLengths}
                onToggle={(serviceId) =>
                  dispatch({ type: "TOGGLE_SERVICE", serviceId })
                }
                onSetLength={(serviceId, length) =>
                  dispatch({ type: "SET_LENGTH", serviceId, length })
                }
                onNext={() => dispatch({ type: "NEXT_STEP" })}
              />
            );
          case "slot": {
            const selectedServices = services.filter((s) =>
              state.selectedServiceIds.includes(s.id),
            );
            return (
              <SlotStep
                services={selectedServices}
                serviceLengths={state.serviceLengths}
                stylists={stylists}
                override={override}
                selectedStylistId={state.selectedStylistId}
                selectedSlot={state.selectedSlot}
                minLeadTimeMinutes={minLeadTimeMinutesOverride}
                onSelectStylist={(stylistId) =>
                  dispatch({ type: "SELECT_STYLIST", stylistId })
                }
                onSelectSlot={(slot) => dispatch({ type: "SELECT_SLOT", slot })}
                onPrev={() => dispatch({ type: "PREV_STEP" })}
                onNext={() => dispatch({ type: "NEXT_STEP" })}
              />
            );
          }
          case "customer":
            return (
              <CustomerStep
                initial={state.customer}
                onSubmit={(customer) => {
                  dispatch({ type: "SET_CUSTOMER", customer });
                  dispatch({ type: "NEXT_STEP" });
                }}
                onPrev={() => dispatch({ type: "PREV_STEP" })}
              />
            );
          case "confirm": {
            const selectedServices = services.filter((s) =>
              state.selectedServiceIds.includes(s.id),
            );
            const stylist =
              state.selectedSlot &&
              stylists.find((s) => s.id === state.selectedSlot!.stylistId);
            if (
              selectedServices.length === 0 ||
              !state.selectedSlot ||
              !stylist ||
              !state.customer
            ) {
              return (
                <div className="text-sm text-warning bg-warning-soft border border-warning/20 rounded-md p-3">
                  Rezervace má neúplná data. Začněte prosím od začátku.
                </div>
              );
            }
            return (
              <ConfirmStep
                services={selectedServices}
                serviceLengths={state.serviceLengths}
                stylist={stylist}
                slot={state.selectedSlot}
                customer={state.customer}
                onPrev={() => dispatch({ type: "PREV_STEP" })}
                onSuccess={(result) =>
                  dispatch({ type: "SUBMIT_SUCCESS", result })
                }
              />
            );
          }
          case "success": {
            if (!state.result) {
              return (
                <div className="text-sm text-warning bg-warning-soft border border-warning/20 rounded-md p-3">
                  Chybí výsledek rezervace.
                </div>
              );
            }
            return <SuccessStep result={state.result} />;
          }
        }
      })()}
    </div>
  );
}

const STEPS = [
  { key: "services", label: "Služba" },
  { key: "slot", label: "Termín" },
  { key: "customer", label: "Kontakt" },
  { key: "confirm", label: "Potvrzení" },
];

function StepProgress({ current }: { current: number }) {
  return (
    <div className="mb-10 md:mb-14">
      <div className="flex items-center justify-center gap-1 md:gap-2">
        {STEPS.map((step, i) => {
          const completed = i < current;
          const active = i === current;
          return (
            <div key={step.key} className="flex items-center gap-1 md:gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-full transition-all duration-300",
                  active &&
                    "bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/50 shadow-[0_0_20px_rgba(212,165,116,0.2)]",
                  completed &&
                    "bg-[var(--color-accent)]/[0.06] border border-[var(--color-accent)]/30",
                  !active && !completed && "border border-white/10",
                )}
              >
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                    (active || completed) &&
                      "bg-[var(--color-accent)] text-[var(--color-bg-base)]",
                    !active &&
                      !completed &&
                      "border border-white/20 text-white/40",
                  )}
                >
                  {completed ? "✓" : i + 1}
                </div>
                <span
                  className={cn(
                    "hidden md:inline text-xs uppercase tracking-[0.15em] transition-colors",
                    active && "text-[var(--color-accent-bright)]",
                    completed && "text-white/60",
                    !active && !completed && "text-white/30",
                  )}
                >
                  {step.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px w-3 md:w-8 transition-colors",
                    completed ? "bg-[var(--color-accent)]/40" : "bg-white/10",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookingLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-1/3 rounded-md bg-bg-soft" />
      <div className="space-y-2">
        <div className="h-16 rounded-md bg-bg-soft" />
        <div className="h-16 rounded-md bg-bg-soft" />
        <div className="h-16 rounded-md bg-bg-soft" />
      </div>
    </div>
  );
}
