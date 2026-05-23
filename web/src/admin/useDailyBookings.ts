/**
 * Daily-schedule data hook + status-transition mutations.
 *
 * Per selected date, fetches bookings (per active stylist, parallelized
 * via Promise.all using composite index `stylistId+startAt`) + paired
 * bookingCustomers (PII — staff-only per rules) + absences for the day.
 *
 * One-shot fetch with reload() exposed — Day 4 real-time refresh after
 * other staff edits could use onSnapshot; deferred for MVP shipper mode.
 *
 * Status transitions (cancelBooking / completeBooking / markNoShow) write
 * directly via Firestore client SDK; rules allow isStaff() create/update,
 * isOwner() delete (D-018 D5 cleanup notwithstanding).
 */
import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { convertTimestampsToDate } from "@hsb/shared";
import type {
  Absence,
  Booking,
  BookingCustomer,
  PaymentMethod,
  Stylist,
} from "@hsb/shared";
import { db } from "../lib/firebase";

export type DailyBooking = {
  booking: Booking;
  /** PII — staff-only (rules-gated). Null if customer doc was deleted
   *  (defensive — shouldn't happen with CF-only writes, but seeds can
   *  diverge during dev). */
  customer: BookingCustomer | null;
};

export type DailyData = {
  bookingsByStylist: Map<string, DailyBooking[]>;
  absencesByStylist: Map<string, Absence[]>;
};

export function useDailyBookings(date: Date, stylists: Stylist[]): {
  data: DailyData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    (async () => {
      try {
        // Parallel per-stylist fetch — uses (stylistId, startAt) composite.
        const perStylist = await Promise.all(
          stylists.map(async (st) => {
            const [bkgSnap, absSnap] = await Promise.all([
              getDocs(
                query(
                  collection(db, "bookings"),
                  where("stylistId", "==", st.id),
                  where("startAt", ">=", dayStart),
                  where("startAt", "<", dayEnd),
                ),
              ),
              getDocs(
                query(
                  collection(db, "absences"),
                  where("stylistId", "==", st.id),
                  where("endAt", ">=", dayStart),
                ),
              ),
            ]);
            const bookings = bkgSnap.docs.map((d) => {
              const dataRaw = convertTimestampsToDate<Omit<Booking, "id">>(
                d.data(),
              );
              return { id: d.id, ...dataRaw } as Booking;
            });
            const absences = absSnap.docs
              .map((d) => {
                const dataRaw = convertTimestampsToDate<Omit<Absence, "id">>(
                  d.data(),
                );
                return { id: d.id, ...dataRaw } as Absence;
              })
              .filter((a) => a.startAt < dayEnd);
            return { stylistId: st.id, bookings, absences };
          }),
        );

        // Customer fetch per booking — PII, rules-gated. ~20-30 bookings
        // per day worst-case = manageable Promise.all surface.
        const allBookings = perStylist.flatMap((p) => p.bookings);
        const customerSnaps = await Promise.all(
          allBookings.map((b) => getDoc(doc(db, "bookingCustomers", b.id))),
        );
        const customerById = new Map<string, BookingCustomer>();
        customerSnaps.forEach((snap, i) => {
          if (snap.exists()) {
            customerById.set(allBookings[i]!.id, snap.data() as BookingCustomer);
          }
        });

        const bookingsByStylist = new Map<string, DailyBooking[]>();
        const absencesByStylist = new Map<string, Absence[]>();
        for (const p of perStylist) {
          bookingsByStylist.set(
            p.stylistId,
            p.bookings
              .map((b) => ({
                booking: b,
                customer: customerById.get(b.id) ?? null,
              }))
              .sort(
                (a, b) =>
                  a.booking.startAt.getTime() - b.booking.startAt.getTime(),
              ),
          );
          absencesByStylist.set(p.stylistId, p.absences);
        }

        if (!cancelled) setData({ bookingsByStylist, absencesByStylist });
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date, stylists, tick]);

  return { data, loading, error, reload };
}

// ---- Status transition mutations ----

export async function cancelBooking(bookingId: string): Promise<void> {
  await updateDoc(doc(db, "bookings", bookingId), {
    status: "cancelled",
    updatedAt: new Date(),
  });
}

export async function completeBooking(
  bookingId: string,
  paymentMethod: PaymentMethod,
): Promise<void> {
  await updateDoc(doc(db, "bookings", bookingId), {
    status: "completed",
    paymentMethod,
    updatedAt: new Date(),
  });
}

export async function markNoShow(bookingId: string): Promise<void> {
  await updateDoc(doc(db, "bookings", bookingId), {
    status: "no_show",
    updatedAt: new Date(),
  });
}
