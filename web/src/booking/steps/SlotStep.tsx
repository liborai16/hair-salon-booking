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
      <h1 className="text-3xl md:text-4xl mb-2">Kadeřník a termín</h1>
      <p className="text-muted mb-8">
        Vyberte kadeřníka nebo nechte „kdokoliv" pro nejvíce volných termínů.
      </p>

      <div className="mb-8">
        <div className="label-mono mb-3">Kadeřník</div>
        <div className="flex flex-wrap gap-2">
          <StylistChip
            label="Kdokoliv"
            selected={selectedStylistId === null}
            onClick={() => onSelectStylist(null)}
          />
          {qualified.map((st) => (
            <StylistChip
              key={st.id}
              label={st.name}
              selected={selectedStylistId === st.id}
              onClick={() => onSelectStylist(st.id)}
            />
          ))}
        </div>
        {qualified.length === 0 && (
          <div className="mt-3 text-sm text-warning bg-warning-soft border border-warning/20 rounded-md p-3">
            Žádný kadeřník neumí všechny vybrané služby. Vraťte se zpět a
            upravte výběr.
          </div>
        )}
      </div>

      {loading && <SlotsLoadingSkeleton />}
      {error && (
        <div className="text-sm text-danger bg-danger-soft border border-danger/20 rounded-md p-3">
          Chyba: {error}
        </div>
      )}

      {slots !== null && !loading && (
        <div className="space-y-6">
          {byDay.size === 0 ? (
            <EmptySlots />
          ) : (
            Array.from(byDay.entries()).map(([ymd, daySlots]) => (
              <div key={ymd}>
                <h2 className="label-mono mb-3">{formatDayHeading(ymd)}</h2>
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
                        className={
                          isSelected
                            ? "text-sm font-medium px-4 py-2.5 rounded-md border border-fg bg-fg text-surface-fg min-h-[44px] transition"
                            : "text-sm font-medium px-4 py-2.5 rounded-md border border-hairline hover:border-fg hover:bg-bg-soft min-h-[44px] transition"
                        }
                      >
                        {hhmm}
                        {selectedStylistId === null && stylist && (
                          <span
                            className={`ml-2 text-xs ${
                              isSelected ? "text-surface-muted" : "text-muted"
                            }`}
                          >
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

      <div className="mt-10 border-t border-hairline pt-6 flex items-center justify-between">
        <button type="button" onClick={onPrev} className="btn-ghost">
          ← Zpět
        </button>
        {selectedSlot && (
          <button
            type="button"
            onClick={onNext}
            className="btn-primary btn-primary-hover"
          >
            Pokračovat →
          </button>
        )}
      </div>
    </div>
  );
}

function StylistChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        selected
          ? "px-4 py-2.5 rounded-pill border border-fg bg-fg text-surface-fg text-sm font-medium min-h-[44px] transition"
          : "px-4 py-2.5 rounded-pill border border-hairline hover:border-fg text-sm font-medium min-h-[44px] transition"
      }
    >
      {label}
    </button>
  );
}

function SlotsLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[1, 2, 3].map((day) => (
        <div key={day}>
          <div className="h-3 w-20 bg-bg-soft rounded mb-3" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 + ((day * 3) % 5) }).map((_, i) => (
              <div
                key={i}
                className="h-11 w-20 rounded-md bg-bg-soft"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptySlots() {
  return (
    <div className="border border-dashed border-hairline rounded-lg p-10 text-center">
      <div className="font-display text-2xl text-muted mb-2">∅</div>
      <div className="font-medium text-fg mb-1">Žádné volné termíny</div>
      <div className="text-sm text-muted max-w-sm mx-auto">
        V nejbližších 14 dnech nemáme pro vybranou kombinaci volný slot.
        Zkuste jiného kadeřníka nebo méně služeb.
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
