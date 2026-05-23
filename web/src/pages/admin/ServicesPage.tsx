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
import type { LengthVariants, Service, ServiceCategory } from "@hsb/shared";
import { db } from "../../lib/firebase";

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  strihani: "Stříhání",
  barveni: "Barvení",
  foukana: "Foukaná",
  osetreni: "Ošetření",
  detsky: "Dětské",
  svatebni: "Svatební",
};
const CATEGORIES = Object.keys(CATEGORY_LABELS) as ServiceCategory[];

function slugify(name: string): string {
  return (
    "svc-" +
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

export function ServicesPage() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Service | "new" | null>(null);

  async function reload() {
    setError(null);
    try {
      const snap = await getDocs(collection(db, "services"));
      setServices(
        snap.docs.map((d) => {
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

  async function toggleActive(s: Service) {
    await updateDoc(doc(db, "services", s.id), {
      active: !s.active,
      updatedAt: serverTimestamp(),
    });
    void reload();
  }

  if (!services) {
    return <div className="text-stone-500">Načítám…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Služby</h1>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="bg-stone-900 text-white px-4 py-2 rounded-md hover:bg-stone-800 transition"
        >
          + Přidat službu
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr className="text-left text-stone-600">
              <th className="px-4 py-2 font-medium">Název</th>
              <th className="px-4 py-2 font-medium">Kategorie</th>
              <th className="px-4 py-2 font-medium">Délka</th>
              <th className="px-4 py-2 font-medium">Cena</th>
              <th className="px-4 py-2 font-medium">Stav</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b border-stone-100 last:border-b-0">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2">{CATEGORY_LABELS[s.category]}</td>
                <td className="px-4 py-2">{s.durationMinutes} min</td>
                <td className="px-4 py-2">
                  {s.basePrice} Kč
                  {s.lengthVariants && (
                    <span className="text-stone-400 text-xs ml-1">
                      (S/M/L)
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => void toggleActive(s)}
                    className={`text-xs px-2 py-1 rounded ${
                      s.active
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                    }`}
                  >
                    {s.active ? "Aktivní" : "Neaktivní"}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="text-stone-600 hover:text-stone-900 text-sm"
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
        <ServiceForm
          initial={editing === "new" ? null : editing}
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

function ServiceForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Service | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<ServiceCategory>(
    initial?.category ?? "strihani",
  );
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 30);
  const [basePrice, setBasePrice] = useState(initial?.basePrice ?? 500);
  const [lengthVariants, setLengthVariants] = useState<LengthVariants | null>(
    initial?.lengthVariants ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBarveni = category === "barveni";
  const canSubmit =
    name.trim().length >= 2 && duration > 0 && basePrice >= 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const id = initial?.id ?? slugify(name);
      const data: Record<string, unknown> = {
        name: name.trim(),
        category,
        durationMinutes: duration,
        basePrice,
        updatedAt: serverTimestamp(),
        ...(isBarveni && lengthVariants ? { lengthVariants } : {}),
      };
      if (initial) {
        await updateDoc(doc(db, "services", id), data);
      } else {
        await setDoc(doc(db, "services", id), {
          ...data,
          active: true,
          createdAt: serverTimestamp(),
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
        className="bg-white rounded-md max-w-md w-full p-6 my-8 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {initial ? "Upravit službu" : "Nová služba"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-2xl leading-none"
            aria-label="Zavřít"
          >
            ×
          </button>
        </div>

        <label className="block">
          <span className="text-sm text-stone-700">Název *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-stone-300 rounded-md px-3 py-2"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm text-stone-700">Kategorie</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ServiceCategory)}
            className="mt-1 w-full border border-stone-300 rounded-md px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-stone-700">Délka (min)</span>
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 w-full border border-stone-300 rounded-md px-3 py-2"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm text-stone-700">Cena (Kč)</span>
            <input
              type="number"
              min={0}
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              className="mt-1 w-full border border-stone-300 rounded-md px-3 py-2"
              required
            />
          </label>
        </div>

        {isBarveni && (
          <div className="border border-stone-200 rounded-md p-3">
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={lengthVariants !== null}
                onChange={(e) =>
                  setLengthVariants(
                    e.target.checked
                      ? { short: basePrice, medium: basePrice, long: basePrice }
                      : null,
                  )
                }
              />
              <span className="text-sm">Cena podle délky vlasů</span>
            </label>
            {lengthVariants && (
              <div className="grid grid-cols-3 gap-2">
                {(["short", "medium", "long"] as const).map((len) => (
                  <label key={len} className="block">
                    <span className="text-xs text-stone-600 capitalize">
                      {len === "short"
                        ? "Krátké"
                        : len === "medium"
                          ? "Střední"
                          : "Dlouhé"}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={lengthVariants[len]}
                      onChange={(e) =>
                        setLengthVariants({
                          ...lengthVariants,
                          [len]: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full border border-stone-300 rounded-md px-2 py-1 text-sm"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-stone-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="text-stone-600 hover:text-stone-900 px-4 py-2"
          >
            Zrušit
          </button>
          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800 transition disabled:opacity-40"
          >
            {busy ? "Ukládám…" : initial ? "Uložit" : "Vytvořit"}
          </button>
        </div>
      </form>
    </div>
  );
}
