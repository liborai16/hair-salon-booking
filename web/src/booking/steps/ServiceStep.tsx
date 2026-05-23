import { computeTotalDuration, LEVEL_MULTIPLIER } from "@hsb/shared";
import type { Service, ServiceCategory, ServiceLengthMap } from "@hsb/shared";

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

  // Group by category for the picker (categorized per case study spec).
  const grouped = services.reduce((acc, svc) => {
    const list = acc.get(svc.category) ?? [];
    list.push(svc);
    acc.set(svc.category, list);
    return acc;
  }, new Map<ServiceCategory, Service[]>());

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">1. Vyberte služby</h1>
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([cat, list]) => (
          <div key={cat}>
            <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-2">
              {CATEGORY_LABELS[cat]}
            </h2>
            <div className="space-y-2">
              {list.map((svc) => {
                const isSelected = selectedIds.includes(svc.id);
                const usesLength =
                  svc.category === "barveni" && svc.lengthVariants !== undefined;
                return (
                  <div
                    key={svc.id}
                    className={`border rounded-md p-3 cursor-pointer transition ${
                      isSelected
                        ? "border-stone-900 bg-stone-100"
                        : "border-stone-200 hover:border-stone-300"
                    }`}
                    onClick={() => onToggle(svc.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{svc.name}</div>
                        <div className="text-sm text-stone-500">
                          {svc.durationMinutes} min · od {svc.basePrice} Kč
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="h-5 w-5"
                      />
                    </div>
                    {isSelected && usesLength && (
                      <div
                        className="mt-3 flex flex-wrap gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(["short", "medium", "long"] as const).map((len) => {
                          const active =
                            (serviceLengths[svc.id] ?? "short") === len;
                          return (
                            <button
                              key={len}
                              type="button"
                              onClick={() => onSetLength(svc.id, len)}
                              className={`text-xs px-3 py-1 rounded-md border ${
                                active
                                  ? "border-stone-900 bg-stone-900 text-white"
                                  : "border-stone-300 hover:border-stone-500"
                              }`}
                            >
                              {LENGTH_LABELS[len]} ({svc.lengthVariants![len]}{" "}
                              Kč)
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedIds.length > 0 && (
        <div className="mt-8 border-t border-stone-200 pt-6 flex items-center justify-between">
          <div>
            <div className="text-sm text-stone-500">
              Vybráno {selectedIds.length} služ.
            </div>
            <div className="font-medium">
              ~{estDuration} min · ~{estPrice} Kč
            </div>
            <div className="text-xs text-stone-400 mt-1">
              Odhad ve standardní tarifě — finální cena podle vybraného
              kadeřníka.
            </div>
          </div>
          <button
            type="button"
            onClick={onNext}
            className="bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800 transition"
          >
            Pokračovat →
          </button>
        </div>
      )}
    </div>
  );
}
