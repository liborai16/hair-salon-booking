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

const inputCls =
  "mt-1.5 w-full border border-hairline rounded-md px-3.5 py-2.5 text-fg " +
  "bg-bg focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/10 " +
  "transition";

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
      <h1 className="text-3xl md:text-4xl mb-2">Vaše údaje</h1>
      <p className="text-muted mb-8">
        Potvrzení a odkaz na zrušení vám pošleme na e-mail.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) {
            onSubmit({ name: name.trim(), phone, email: email.trim() });
          }
        }}
        className="space-y-5 max-w-md"
      >
        <label className="block">
          <span className="label-mono text-fg">Jméno *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            autoComplete="name"
            required
          />
        </label>

        <label className="block">
          <span className="label-mono text-fg">
            Telefon *{" "}
            <span className="normal-case tracking-normal text-muted">
              (s předvolbou, např. +420…)
            </span>
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
            autoComplete="tel"
            required
          />
          {!phoneValid && phone.length > 4 && (
            <span className="text-xs text-warning mt-1.5 block">
              Formát E.164: + a 8–15 číslic (např. +420600100200)
            </span>
          )}
        </label>

        <label className="block">
          <span className="label-mono text-fg">E-mail *</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            autoComplete="email"
            required
          />
        </label>

        <label className="flex items-start gap-3 pt-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-5 w-5 accent-fg"
            required
          />
          <span className="text-sm text-muted">
            Souhlasím se zpracováním osobních údajů pro účely rezervace.
            Jméno, telefon a e-mail jsou uloženy odděleně od veřejných dat
            o rezervaci (PII split).
          </span>
        </label>

        <div className="border-t border-hairline pt-6 flex items-center justify-between">
          <button type="button" onClick={onPrev} className="btn-ghost">
            ← Zpět
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary btn-primary-hover"
          >
            Pokračovat →
          </button>
        </div>
      </form>
    </div>
  );
}
