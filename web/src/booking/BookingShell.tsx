import { useReducer } from "react";
import {
  useSalonOverride,
  useServices,
  useStylists,
} from "./useBookingData";
import { bookingReducer, initialBookingState } from "./state";
import { ServiceStep } from "./steps/ServiceStep";
import { SlotStep } from "./steps/SlotStep";

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
    case "confirm":
      return (
        <div>
          <h1 className="text-2xl font-semibold mb-4">
            {state.step === "customer" ? "3. Vaše údaje" : "4. Potvrzení"}
          </h1>
          <p className="text-stone-500">
            Krok je v přípravě (Phase 2.2: customer form + booking submit).
          </p>
          <button
            type="button"
            onClick={() => dispatch({ type: "PREV_STEP" })}
            className="mt-6 text-stone-600 hover:text-stone-900 px-4 py-2"
          >
            ← Zpět
          </button>
        </div>
      );
  }
}
