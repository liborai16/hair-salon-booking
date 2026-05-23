import type { ServiceLengthMap } from "@hsb/shared";

export type BookingStep = "services" | "slot" | "customer" | "confirm";

export type SelectedSlot = {
  stylistId: string;
  start: Date;
  end: Date;
};

export type BookingState = {
  step: BookingStep;
  selectedServiceIds: string[];
  serviceLengths: ServiceLengthMap;
  selectedStylistId: string | null; // null = "kdokoliv" anyone-mode (D-018 D3)
  selectedSlot: SelectedSlot | null;
  customer: { name: string; phone: string; email: string } | null;
};

export type BookingAction =
  | { type: "TOGGLE_SERVICE"; serviceId: string }
  | { type: "SET_LENGTH"; serviceId: string; length: "short" | "medium" | "long" }
  | { type: "SELECT_STYLIST"; stylistId: string | null }
  | { type: "SELECT_SLOT"; slot: SelectedSlot }
  | { type: "SET_CUSTOMER"; customer: { name: string; phone: string; email: string } }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" };

export const initialBookingState: BookingState = {
  step: "services",
  selectedServiceIds: [],
  serviceLengths: {},
  selectedStylistId: null,
  selectedSlot: null,
  customer: null,
};

const stepOrder: BookingStep[] = ["services", "slot", "customer", "confirm"];

export function bookingReducer(s: BookingState, a: BookingAction): BookingState {
  switch (a.type) {
    case "TOGGLE_SERVICE": {
      const has = s.selectedServiceIds.includes(a.serviceId);
      return {
        ...s,
        selectedServiceIds: has
          ? s.selectedServiceIds.filter((id) => id !== a.serviceId)
          : [...s.selectedServiceIds, a.serviceId],
        serviceLengths: has
          ? Object.fromEntries(
              Object.entries(s.serviceLengths).filter(([k]) => k !== a.serviceId),
            )
          : s.serviceLengths,
        selectedSlot: null, // service change invalidates slot
      };
    }
    case "SET_LENGTH":
      return {
        ...s,
        serviceLengths: { ...s.serviceLengths, [a.serviceId]: a.length },
        selectedSlot: null,
      };
    case "SELECT_STYLIST":
      return { ...s, selectedStylistId: a.stylistId, selectedSlot: null };
    case "SELECT_SLOT":
      return { ...s, selectedSlot: a.slot };
    case "SET_CUSTOMER":
      return { ...s, customer: a.customer };
    case "NEXT_STEP": {
      const i = stepOrder.indexOf(s.step);
      return { ...s, step: stepOrder[i + 1] ?? s.step };
    }
    case "PREV_STEP": {
      const i = stepOrder.indexOf(s.step);
      return { ...s, step: stepOrder[i - 1] ?? s.step };
    }
  }
}
