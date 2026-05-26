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
import { cn } from "@/lib/cn";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const CZ_WEEKDAYS = [
  "Neděle",
  "Pondělí",
  "Úterý",
  "Středa",
  "Čtvrtek",
  "Pátek",
  "Sobota",
];
const CZ_MONTHS_GENITIVE = [
  "ledna",
  "února",
  "března",
  "dubna",
  "května",
  "června",
  "července",
  "srpna",
  "září",
  "října",
  "listopadu",
  "prosince",
];

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

      <div className="mb-10">
        <div className="label-mono mb-4 md:mb-5">Kadeřník</div>
        <div className="flex flex-wrap items-start justify-center gap-4 md:gap-6">
          <StylistAvatar
            symbol="✦"
            label="Kdokoliv"
            selected={selectedStylistId === null}
            onClick={() => onSelectStylist(null)}
          />
          {qualified.map((st) => (
            <StylistAvatar
              key={st.id}
              symbol={getInitials(st.name)}
              label={st.name}
              selected={selectedStylistId === st.id}
              onClick={() => onSelectStylist(st.id)}
            />
          ))}
        </div>
        {qualified.length === 0 && (
          <div className="mt-4 text-sm text-warning bg-warning-soft border border-warning/20 rounded-md p-3">
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
        <div className="space-y-8 md:space-y-10">
          {byDay.size === 0 ? (
            <EmptySlots />
          ) : (
            Array.from(byDay.entries()).map(([ymd, daySlots]) => {
              const day = formatDayParts(ymd);
              return (
                <div key={ymd}>
                  <div className="mb-4 md:mb-5">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-accent)]/70 mb-1">
                      {day.weekday}
                    </div>
                    <div className="font-display text-xl md:text-2xl tracking-tight">
                      {day.date}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
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
                          className={cn(
                            "px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                            "backdrop-blur-xl border min-h-[44px]",
                            isSelected
                              ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg-base)] shadow-[0_0_20px_rgba(212,165,116,0.3)]"
                              : "border-white/10 bg-white/[0.03] text-white hover:border-[var(--color-accent)]/40 hover:bg-white/[0.06] hover:-translate-y-0.5",
                          )}
                        >
                          {hhmm}
                          {selectedStylistId === null && stylist && (
                            <span
                              className={cn(
                                "ml-2 text-xs",
                                isSelected
                                  ? "text-[var(--color-bg-base)]/70"
                                  : "text-white/50",
                              )}
                            >
                              {stylist.name.split(" ")[0]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
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

function StylistAvatar({
  symbol,
  label,
  selected,
  onClick,
}: {
  symbol: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 transition-all duration-300 cursor-pointer w-20"
    >
      <div
        className={cn(
          "w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center",
          "font-display text-lg md:text-xl tracking-wider transition-all duration-300",
          "backdrop-blur-xl",
          selected
            ? "bg-[var(--color-accent)] text-[var(--color-bg-base)] shadow-[0_0_30px_rgba(212,165,116,0.4)]"
            : "bg-white/[0.04] border border-white/10 text-white/70 group-hover:border-[var(--color-accent)]/40 group-hover:text-white",
        )}
      >
        {symbol}
      </div>
      <div
        className={cn(
          "text-xs uppercase tracking-[0.1em] text-center transition-colors",
          selected
            ? "text-[var(--color-accent-bright)]"
            : "text-white/60 group-hover:text-white",
        )}
      >
        {label}
      </div>
    </button>
  );
}

function SlotsLoadingSkeleton() {
  return (
    <div className="space-y-8 md:space-y-10 animate-pulse">
      {[1, 2, 3].map((day) => (
        <div key={day}>
          <div className="mb-4 md:mb-5">
            <div className="h-3 w-16 bg-white/[0.05] rounded mb-2" />
            <div className="h-6 w-32 bg-white/[0.04] rounded" />
          </div>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
            {Array.from({ length: 6 + ((day * 3) % 5) }).map((_, i) => (
              <div
                key={i}
                className="h-11 rounded-xl bg-white/[0.03] border border-white/[0.05]"
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
    <div className="text-center py-16">
      <div className="text-5xl mb-4 opacity-40">∅</div>
      <div className="font-display text-xl md:text-2xl mb-2">
        Žádné volné termíny
      </div>
      <p className="text-white/60 text-sm max-w-md mx-auto">
        Pro tento výběr se nepodařilo najít volný čas v nejbližších 14 dnech.
        Zkuste jiného kadeřníka nebo méně služeb.
      </p>
    </div>
  );
}

function formatDayParts(ymd: string): { weekday: string; date: string } {
  const [Y, M, D] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(Y!, M! - 1, D!));
  return {
    weekday: CZ_WEEKDAYS[date.getUTCDay()]!,
    date: `${D}. ${CZ_MONTHS_GENITIVE[(M ?? 1) - 1]}`,
  };
}
