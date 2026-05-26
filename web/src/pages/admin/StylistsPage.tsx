import { useEffect, useState, type FormEvent } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { convertTimestampsToDate } from "@hsb/shared";
import type {
  Service,
  Stylist,
  StylistLevel,
  TimeRange,
  WeeklyHours,
} from "@hsb/shared";
import { db } from "../../lib/firebase";

const LEVEL_LABELS: Record<StylistLevel, string> = {
  junior: "Junior (-20 %)",
  standard: "Standard",
  senior: "Senior (+30 %)",
};

const WEEKDAYS: Array<{ key: keyof WeeklyHours; label: string }> = [
  { key: "monday", label: "Po" },
  { key: "tuesday", label: "Út" },
  { key: "wednesday", label: "St" },
  { key: "thursday", label: "Čt" },
  { key: "friday", label: "Pá" },
  { key: "saturday", label: "So" },
  { key: "sunday", label: "Ne" },
];

const DEFAULT_HOURS: WeeklyHours = {
  monday: { start: "09:00", end: "17:00" },
  tuesday: { start: "09:00", end: "17:00" },
  wednesday: { start: "09:00", end: "17:00" },
  thursday: { start: "09:00", end: "17:00" },
  friday: { start: "09:00", end: "17:00" },
  saturday: null,
  sunday: null,
};

function slugify(name: string): string {
  return (
    "stl-" +
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Date.now().toString(36)
  );
}

export function StylistsPage() {
  const [stylists, setStylists] = useState<Stylist[] | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Stylist | "new" | null>(null);

  async function reload() {
    setError(null);
    try {
      const [stSnap, svcSnap] = await Promise.all([
        getDocs(collection(db, "stylists")),
        getDocs(collection(db, "services")),
      ]);
      setStylists(
        stSnap.docs.map((d) => {
          const data = convertTimestampsToDate<Omit<Stylist, "id">>(d.data());
          return { id: d.id, ...data } as Stylist;
        }),
      );
      setServices(
        svcSnap.docs.map((d) => {
          const data = convertTimestampsToDate<Omit<Service, "id">>(d.data());
          return { id: d.id, ...data } as Service;
        }),
      );
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void reload();
  }, []);

  async function toggleActive(s: Stylist) {
    await updateDoc(doc(db, "stylists", s.id), {
      active: !s.active,
      updatedAt: serverTimestamp(),
    });
    void reload();
  }

  if (!stylists || !services) {
    return <div className="text-white/50">Načítám…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl md:text-3xl tracking-tight text-white">Kadeřníci</h1>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="btn-primary btn-primary-hover"
        >
          + Přidat kadeřníka
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/[0.05] border border-[var(--color-danger)]/30 rounded-xl p-3">
          {error}
        </div>
      )}

      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] border-b border-white/10">
            <tr className="text-left text-white/60">
              <th className="px-4 py-2 font-medium">Jméno</th>
              <th className="px-4 py-2 font-medium">Tarif</th>
              <th className="px-4 py-2 font-medium">Služby</th>
              <th className="px-4 py-2 font-medium">Stav</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {stylists.map((s) => (
              <tr key={s.id} className="border-b border-white/5 last:border-b-0">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2">{LEVEL_LABELS[s.level]}</td>
                <td className="px-4 py-2 text-white/50">
                  {s.serviceIds.length}
                </td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => void toggleActive(s)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      s.active
                        ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                        : "bg-white/[0.05] text-white/40 hover:bg-white/[0.08]"
                    }`}
                  >
                    {s.active ? "Aktivní" : "Neaktivní"}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="text-white/60 hover:text-white text-sm"
                  >
                    Upravit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <StylistForm
          initial={editing === "new" ? null : editing}
          services={services}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function StylistForm({
  initial,
  services,
  onClose,
  onSaved,
}: {
  initial: Stylist | null;
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [level, setLevel] = useState<StylistLevel>(initial?.level ?? "standard");
  const [serviceIds, setServiceIds] = useState<string[]>(initial?.serviceIds ?? []);
  const [hours, setHours] = useState<WeeklyHours>(
    initial?.weeklyHours ?? DEFAULT_HOURS,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length >= 2 && serviceIds.length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const id = initial?.id ?? slugify(name);
      if (initial) {
        await updateDoc(doc(db, "stylists", id), {
          name: name.trim(),
          level,
          serviceIds,
          weeklyHours: hours,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, "stylists", id), {
          name: name.trim(),
          level,
          serviceIds,
          weeklyHours: hours,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      onSaved();
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message ?? "Uložení selhalo.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-bg-base)] border border-white/10 backdrop-blur-xl rounded-2xl max-w-2xl w-full p-6 my-8 space-y-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {initial ? "Upravit kadeřníka" : "Nový kadeřník"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-2xl leading-none"
            aria-label="Zavřít"
          >
            ×
          </button>
        </div>

        <label className="block">
          <span className="text-sm text-white/80">Jméno *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-white/15 rounded-md px-3 py-2"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm text-white/80">Tarif</span>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as StylistLevel)}
            className="mt-1 w-full border border-white/15 rounded-md px-3 py-2"
          >
            {(["junior", "standard", "senior"] as const).map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="text-sm text-white/80 mb-2">
            Služby * (alespoň jedna)
          </div>
          <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto border border-white/10 rounded-md p-2">
            {services
              .filter((s) => s.active)
              .map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 text-sm hover:bg-white/[0.04] px-2 py-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={serviceIds.includes(s.id)}
                    onChange={(e) => {
                      setServiceIds((prev) =>
                        e.target.checked
                          ? [...prev, s.id]
                          : prev.filter((id) => id !== s.id),
                      );
                    }}
                  />
                  {s.name}
                </label>
              ))}
          </div>
        </div>

        <div>
          <div className="text-sm text-white/80 mb-2">Pracovní doba</div>
          <div className="space-y-2">
            {WEEKDAYS.map(({ key, label }) => (
              <WeekdayRow
                key={key}
                label={label}
                value={hours[key]}
                onChange={(value) => setHours((h) => ({ ...h, [key]: value }))}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/[0.05] border border-[var(--color-danger)]/30 rounded-xl p-3">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white px-4 py-2"
          >
            Zrušit
          </button>
          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="btn-primary btn-primary-hover"
          >
            {busy ? "Ukládám…" : initial ? "Uložit" : "Vytvořit"}
          </button>
        </div>
      </form>
    </div>
  );
}

function WeekdayRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TimeRange | null;
  onChange: (value: TimeRange | null) => void;
}) {
  const active = value !== null;
  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 w-20">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) =>
            onChange(e.target.checked ? { start: "09:00", end: "17:00" } : null)
          }
        />
        <span className="text-sm">{label}</span>
      </label>
      {active ? (
        <>
          <input
            type="time"
            value={value!.start}
            onChange={(e) => onChange({ ...value!, start: e.target.value })}
            className="border border-white/15 rounded-md px-2 py-1 text-sm"
          />
          <span className="text-white/40">–</span>
          <input
            type="time"
            value={value!.end}
            onChange={(e) => onChange({ ...value!, end: e.target.value })}
            className="border border-white/15 rounded-md px-2 py-1 text-sm"
          />
        </>
      ) : (
        <span className="text-sm text-white/40">Volno</span>
      )}
    </div>
  );
}
