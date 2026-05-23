import { useEffect, useMemo, useState } from "react";
import {
  generateAvailableSlots,
  instantToWallParts,
  SALON_TZ,
} from "@hsb/shared";
import type {
  BusinessHoursOverride,
  Service,
  ServiceLengthMap,
  Slot,
  Stylist,
} from "@hsb/shared";
import { buildAvailabilityInputs } from "../useBookingData";
import type { SelectedSlot } from "../state";

type Props = {
  services: Service[]; // already filtered to selected
  serviceLengths: ServiceLengthMap;
  stylists: Stylist[]; // all active
  override: BusinessHoursOverride[];
  selectedStylistId: string | null; // null = anyone-mode
  selectedSlot: SelectedSlot | null;
  /** Admin walk-in passes 0 (immediate booking allowed); undefined falls
   *  back to D-018 default 120 min. Mirrors CF wrapper staff-bypass. */
  minLeadTimeMinutes?: number;
  onSelectStylist: (id: string | null) => void;
  onSelectSlot: (slot: SelectedSlot) => void;
  onPrev: () => void;
  onNext: () => void;
};

export function SlotStep({
  services,
  serviceLengths,
  stylists,
  override,
  selectedStylistId,
  selectedSlot,
  minLeadTimeMinutes,
  onSelectStylist,
  onSelectSlot,
  onPrev,
  onNext,
}: Props) {
  // Capability filter — qualified stylists for ALL selected services.
  const qualified = useMemo(() => {
    const requiredIds = services.map((s) => s.id);
    return stylists.filter((st) =>
      requiredIds.every((id) => st.serviceIds.includes(id)),
    );
  }, [services, stylists]);

  // Pool for slot generation — single stylist or all qualified.
  const pool = useMemo(() => {
    if (selectedStylistId === null) return qualified;
    return qualified.filter((st) => st.id === selectedStylistId);
  }, [qualified, selectedStylistId]);

  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (pool.length === 0) {
      setSlots([]);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const now = new Date();
        const from = now;
        const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        const inputs = await buildAvailabilityInputs(pool, from, to);
        const all = generateAvailableSlots(inputs, {
          services,
          serviceLengths,
          from,
          to,
          now,
          override,
          ...(minLeadTimeMinutes !== undefined ? { minLeadTimeMinutes } : {}),
        });
        if (!cancelled) setSlots(all);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pool, services, serviceLengths, override, minLeadTimeMinutes]);

  // Group slots by wall-clock day for the picker UI.
  const byDay = useMemo(() => {
    if (!slots) return new Map<string, Slot[]>();
    const m = new Map<string, Slot[]>();
    for (const slot of slots) {
      const ymd = instantToWallParts(slot.start, SALON_TZ).ymd;
      const list = m.get(ymd) ?? [];
      list.push(slot);
      m.set(ymd, list);
    }
    return m;
  }, [slots]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">
        2. Vyberte kadeřníka a termín
      </h1>

      <div className="mb-6">
        <div className="text-sm text-stone-500 mb-2">Kadeřník</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelectStylist(null)}
            className={`px-4 py-2 rounded-md border ${
              selectedStylistId === null
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-300 hover:border-stone-500"
            }`}
          >
            Kdokoliv
          </button>
          {qualified.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onSelectStylist(st.id)}
              className={`px-4 py-2 rounded-md border ${
                selectedStylistId === st.id
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 hover:border-stone-500"
              }`}
            >
              {st.name}
            </button>
          ))}
        </div>
        {qualified.length === 0 && (
          <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
            Žádný kadeřník neumí všechny vybrané služby. Vraťte se zpět a
            upravte výběr.
          </div>
        )}
      </div>

      {loading && <div className="text-stone-500">Načítám volné termíny…</div>}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          Chyba: {error}
        </div>
      )}

      {slots !== null && !loading && (
        <div className="space-y-6">
          {byDay.size === 0 ? (
            <div className="text-stone-500">
              Žádné volné termíny v nejbližších 14 dnech.
            </div>
          ) : (
            Array.from(byDay.entries()).map(([ymd, daySlots]) => (
              <div key={ymd}>
                <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-2">
                  {formatDayHeading(ymd)}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((slot) => {
                    const hhmm = instantToWallParts(slot.start, SALON_TZ).hhmm;
                    const stylist = stylists.find(
                      (s) => s.id === slot.stylistId,
                    );
                    const isSelected =
                      selectedSlot?.start.getTime() === slot.start.getTime() &&
                      selectedSlot?.stylistId === slot.stylistId;
                    return (
                      <button
                        key={`${slot.stylistId}-${slot.start.getTime()}`}
                        type="button"
                        onClick={() => onSelectSlot(slot)}
                        className={`text-sm px-3 py-2 rounded-md border ${
                          isSelected
                            ? "border-stone-900 bg-stone-900 text-white"
                            : "border-stone-300 hover:border-stone-500"
                        }`}
                      >
                        {hhmm}
                        {selectedStylistId === null && stylist && (
                          <span className="ml-2 text-xs opacity-70">
                            {stylist.name.split(" ")[0]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="mt-8 border-t border-stone-200 pt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          className="text-stone-600 hover:text-stone-900 px-4 py-2"
        >
          ← Zpět
        </button>
        {selectedSlot && (
          <button
            type="button"
            onClick={onNext}
            className="bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800 transition"
          >
            Pokračovat →
          </button>
        )}
      </div>
    </div>
  );
}

function formatDayHeading(ymd: string): string {
  const [Y, M, D] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(Y!, M! - 1, D!));
  const weekdays = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
  return `${weekdays[date.getUTCDay()]} ${D}.${M}.`;
}
