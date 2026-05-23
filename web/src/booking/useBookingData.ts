/**
 * Client-side data hooks + helpers for booking flow.
 *
 * Reads public collections (services, stylists, salonSettings) via one-shot
 * `getDocs` — services + stylists change rarely, real-time isn't needed for
 * MVP. Per-stylist availability (absences + bookings) is loaded on-demand
 * inside `SlotStep` whenever the qualified-stylist pool changes.
 *
 * Bookings query uses the `(stylistId, startAt)` composite index from
 * `firestore.indexes.json`. Absences query uses `(stylistId, endAt)` —
 * added in D-018 createBooking integration (commit 9585409).
 *
 * Status filter mirrors `OCCUPYING_STATUSES` from D-018 Caller contract —
 * cancelled/completed/no_show are pre-filtered before passing to
 * `generateAvailableSlots`. (D5 OCCUPYING_STATUSES duplication noted in
 * CLAUDE.md §5; cleanup TBD.)
 */
import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { convertTimestampsToDate } from "@hsb/shared";
import type {
  Absence,
  Booking,
  BookingStatus,
  BusinessHoursOverride,
  SalonSettings,
  Service,
  Stylist,
  StylistAvailabilityInput,
} from "@hsb/shared";
import { db } from "../lib/firebase";

const OCCUPYING_STATUSES = new Set<BookingStatus>(["pending", "confirmed"]);

export function useServices(): {
  services: Service[] | null;
  error: string | null;
} {
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "services"));
        const all = snap.docs.map((d) => {
          const data = convertTimestampsToDate<Omit<Service, "id">>(d.data());
          return { id: d.id, ...data } as Service;
        });
        setServices(all.filter((s) => s.active));
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);
  return { services, error };
}

export function useStylists(): {
  stylists: Stylist[] | null;
  error: string | null;
} {
  const [stylists, setStylists] = useState<Stylist[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "stylists"));
        const all = snap.docs.map((d) => {
          const data = convertTimestampsToDate<Omit<Stylist, "id">>(d.data());
          return { id: d.id, ...data } as Stylist;
        });
        setStylists(all.filter((s) => s.active));
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);
  return { stylists, error };
}

export function useSalonOverride(): BusinessHoursOverride[] {
  const [override, setOverride] = useState<BusinessHoursOverride[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "salonSettings", "main"));
        if (!snap.exists()) return;
        const data = convertTimestampsToDate<SalonSettings>(snap.data());
        setOverride(data.businessHoursOverride ?? []);
      } catch {
        /* silent — default to [] (no overrides) */
      }
    })();
  }, []);
  return override;
}

/** Build per-stylist availability inputs (absences + bookings in window). */
export async function buildAvailabilityInputs(
  stylists: Stylist[],
  from: Date,
  to: Date,
): Promise<StylistAvailabilityInput[]> {
  return Promise.all(
    stylists.map(async (stylist) => {
      const [absSnap, bkgSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "absences"),
            where("stylistId", "==", stylist.id),
            where("endAt", ">=", from),
          ),
        ),
        getDocs(
          query(
            collection(db, "bookings"),
            where("stylistId", "==", stylist.id),
            where("startAt", ">=", from),
            where("startAt", "<", to),
          ),
        ),
      ]);
      const absences = absSnap.docs.map((d) => {
        const data = convertTimestampsToDate<Omit<Absence, "id">>(d.data());
        return { id: d.id, ...data } as Absence;
      });
      const bookings = bkgSnap.docs
        .map((d) => {
          const data = convertTimestampsToDate<Omit<Booking, "id">>(d.data());
          return { id: d.id, ...data } as Booking;
        })
        .filter((b) => OCCUPYING_STATUSES.has(b.status));
      return { stylist, absences, bookings };
    }),
  );
}
