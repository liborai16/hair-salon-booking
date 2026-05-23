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

/**
 * Booking flow orchestrator — useReducer-driven state machine over 4 steps:
 * services → slot → customer → confirm. Phase 2.1 ships steps 1+2 (services
 * + slot picker); steps 3+4 render a placeholder pending Phase 2.2
 * (customer form + createBooking submit).
 *
 * Public data (services / stylists / salonSettings) is loaded once at the
 * shell level and passed down — both step components use it. Per-stylist
 * availability data (absences + bookings) loads inside SlotStep when the
 * qualified pool changes (re-computed per service selection).
 */
export function BookingShell() {
  const [state, dispatch] = useReducer(bookingReducer, initialBookingState);
  const { services, error: servicesError } = useServices();
  const { stylists, error: stylistsError } = useStylists();
  const override = useSalonOverride();

  if (servicesError || stylistsError) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
        Chyba načítání: {servicesError ?? stylistsError}
      </div>
    );
  }

  if (!services || !stylists) {
    return <div className="text-stone-500">Načítám…</div>;
  }

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
      // Guard: confirm requires all upstream state. If user navigated here
      // with a missing piece (e.g. stale state), kick back to services step.
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
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
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
          onSuccess={(result) => dispatch({ type: "SUBMIT_SUCCESS", result })}
        />
      );
    }
    case "success": {
      if (!state.result) {
        return (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
            Chybí výsledek rezervace.
          </div>
        );
      }
      return <SuccessStep result={state.result} />;
    }
  }
}
