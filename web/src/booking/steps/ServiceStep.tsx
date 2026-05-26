import { computeTotalDuration, LEVEL_MULTIPLIER } from "@hsb/shared";
import type { Service, ServiceCategory, ServiceLengthMap } from "@hsb/shared";
import { cn } from "@/lib/cn";

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  strihani: "Stříhání",
  barveni: "Barvení",
  foukana: "Foukaná",
  osetreni: "Ošetření",
  detsky: "Dětské",
  svatebni: "Svatební",
};

const LENGTH_LABELS: Record<"short" | "medium" | "long", string> = {
  short: "Krátké",
  medium: "Střední",
  long: "Dlouhé",
};

type Props = {
  services: Service[];
  selectedIds: string[];
  serviceLengths: ServiceLengthMap;
  onToggle: (serviceId: string) => void;
  onSetLength: (serviceId: string, length: "short" | "medium" | "long") => void;
  onNext: () => void;
};

export function ServiceStep({
  services,
  selectedIds,
  serviceLengths,
  onToggle,
  onSetLength,
  onNext,
}: Props) {
  const selectedServices = services.filter((s) => selectedIds.includes(s.id));
  const estDuration = computeTotalDuration(selectedServices, serviceLengths);
  // Preview at standard tier — final price depends on chosen stylist (D-014).
  const estPrice = selectedServices.reduce((sum, svc) => {
    const usesLength =
      svc.category === "barveni" && svc.lengthVariants !== undefined;
    const base = usesLength
      ? svc.lengthVariants![serviceLengths[svc.id] ?? "short"]
      : svc.basePrice;
    return sum + Math.round(base * LEVEL_MULTIPLIER.standard);
  }, 0);

  const grouped = services.reduce((acc, svc) => {
    const list = acc.get(svc.category) ?? [];
    list.push(svc);
    acc.set(svc.category, list);
    return acc;
  }, new Map<ServiceCategory, Service[]>());

  return (
    <div className="pb-32">
      <h1 className="text-3xl md:text-4xl mb-2">Vyberte služby</h1>
      <p className="text-muted mb-10">
        Kombinujte podle libosti. Cena se přepočítá podle vybraného kadeřníka.
      </p>

      <div className="space-y-12 md:space-y-16">
        {Array.from(grouped.entries()).map(([cat, list]) => (
          <section key={cat}>
            <div className="mb-8 md:mb-10">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-accent)]/70 mb-2">
                {list.length}{" "}
                {list.length === 1
                  ? "služba"
                  : list.length < 5
                    ? "služby"
                    : "služeb"}
              </div>
              <h2 className="font-display text-2xl md:text-3xl tracking-tight">
                {CATEGORY_LABELS[cat]}
              </h2>
              <div className="h-px bg-white/10 mt-4" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
              {list.map((svc) => (
                <ServiceCard
                  key={svc.id}
                  svc={svc}
                  selected={selectedIds.includes(svc.id)}
                  selectedLength={serviceLengths[svc.id]}
                  onToggle={() => onToggle(svc.id)}
                  onSetLength={(len) => onSetLength(svc.id, len)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {selectedIds.length > 0 && <StickyFooter
        count={selectedIds.length}
        duration={estDuration}
        price={estPrice}
        onNext={onNext}
      />}
    </div>
  );
}

function ServiceCard({
  svc,
  selected,
  selectedLength,
  onToggle,
  onSetLength,
}: {
  svc: Service;
  selected: boolean;
  selectedLength: "short" | "medium" | "long" | undefined;
  onToggle: () => void;
  onSetLength: (len: "short" | "medium" | "long") => void;
}) {
  const usesLength =
    svc.category === "barveni" && svc.lengthVariants !== undefined;
  const activeLen = selectedLength ?? "short";

  return (
    <div
      className={cn(
        "w-full text-left p-5 md:p-6 rounded-2xl transition-all duration-300 cursor-pointer",
        "border backdrop-blur-xl",
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/[0.04] shadow-[0_0_30px_rgba(212,165,116,0.15)]"
          : "border-white/[0.08] bg-white/[0.02] hover:border-[var(--color-accent)]/40 hover:bg-white/[0.04]",
      )}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-lg md:text-xl font-medium tracking-tight">
            {svc.name}
          </div>
          <div className="mt-1 label-mono">{svc.durationMinutes} min</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-xl md:text-2xl font-medium tracking-tight text-[var(--color-accent)] tabular-nums">
            {usesLength
              ? svc.lengthVariants![activeLen]
              : svc.basePrice}{" "}
            <span className="text-sm text-muted font-sans font-normal">Kč</span>
          </div>
          {selected && (
            <div
              className="mt-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-accent)] text-[var(--color-bg-base)] text-[10px] font-bold"
              aria-hidden
            >
              ✓
            </div>
          )}
        </div>
      </div>

      {selected && usesLength && (
        <div
          className="mt-5 pt-5 border-t border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="label-mono mb-3">Délka vlasů</div>
          <div className="grid grid-cols-3 gap-1 p-1 bg-black/30 rounded-full border border-white/10">
            {(["short", "medium", "long"] as const).map((len) => {
              const active = activeLen === len;
              return (
                <button
                  key={len}
                  type="button"
                  onClick={() => onSetLength(len)}
                  className={cn(
                    "text-xs font-medium py-2.5 rounded-full transition min-h-[44px]",
                    active
                      ? "bg-[var(--color-accent)] text-[var(--color-bg-base)]"
                      : "text-white/60 hover:text-white",
                  )}
                >
                  {LENGTH_LABELS[len]}
                  <span className="block text-[10px] opacity-70 mt-0.5">
                    {svc.lengthVariants![len]} Kč
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StickyFooter({
  count,
  duration,
  price,
  onNext,
}: {
  count: number;
  duration: number;
  price: number;
  onNext: () => void;
}) {
  return (
    <div className="sticky bottom-4 mt-8 mx-auto max-w-md backdrop-blur-xl bg-black/40 border border-white/10 rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="label-mono mb-0.5 truncate">
            Vybráno {count} {count === 1 ? "služba" : count < 5 ? "služby" : "služeb"}
          </div>
          <div className="font-display text-xl font-medium tracking-tight">
            ~{price} Kč
            <span className="ml-2 text-sm text-muted font-sans font-normal">
              · {duration} min
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="btn-primary btn-primary-hover shrink-0"
        >
          Pokračovat →
        </button>
      </div>
    </div>
  );
}
