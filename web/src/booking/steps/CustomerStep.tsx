import { useState } from "react";

type Props = {
  initial: { name: string; phone: string; email: string } | null;
  onSubmit: (customer: { name: string; phone: string; email: string }) => void;
  onPrev: () => void;
};

// Pragmatic validation: server is the authority (zod strictObject in
// createBooking.schema.ts) but UI gates the "Pokračovat" button to catch
// obvious errors before round-trip.
const PHONE_E164 = /^\+\d{8,15}$/;
const EMAIL_BASIC = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function CustomerStep({ initial, onSubmit, onPrev }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "+420");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [consent, setConsent] = useState(false);

  const phoneValid = PHONE_E164.test(phone);
  const emailValid = EMAIL_BASIC.test(email);
  const canSubmit =
    name.trim().length >= 2 && phoneValid && emailValid && consent;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">3. Vaše údaje</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) {
            onSubmit({ name: name.trim(), phone, email: email.trim() });
          }
        }}
        className="space-y-4 max-w-md"
      >
        <label className="block">
          <span className="text-sm text-stone-700">Jméno *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-stone-300 rounded-md px-3 py-2"
            autoComplete="name"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm text-stone-700">
            Telefon *{" "}
            <span className="text-xs text-stone-500">
              (s předvolbou, např. +420…)
            </span>
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full border border-stone-300 rounded-md px-3 py-2"
            autoComplete="tel"
            required
          />
          {!phoneValid && phone.length > 4 && (
            <span className="text-xs text-amber-700 mt-1 block">
              Formát E.164: + a 8–15 číslic (např. +420600100200)
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm text-stone-700">E-mail *</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-stone-300 rounded-md px-3 py-2"
            autoComplete="email"
            required
          />
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1"
            required
          />
          <span className="text-sm text-stone-700">
            Souhlasím se zpracováním osobních údajů pro účely rezervace
            (jméno, telefon, e-mail jsou uloženy odděleně od veřejných dat
            o rezervaci — PII split).
          </span>
        </label>

        <div className="border-t border-stone-200 pt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onPrev}
            className="text-stone-600 hover:text-stone-900 px-4 py-2"
          >
            ← Zpět
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Pokračovat →
          </button>
        </div>
      </form>
    </div>
  );
}
