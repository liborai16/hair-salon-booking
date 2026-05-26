import { useState } from "react";
import { cn } from "@/lib/cn";

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

const inputCls = [
  "w-full mt-2 px-4 py-3 rounded-xl",
  "bg-white/[0.03] backdrop-blur-xl",
  "border border-white/10",
  "text-white placeholder-white/30",
  "transition-all duration-200",
  "focus:outline-none focus:border-[var(--color-accent)]/50 focus:bg-white/[0.06]",
  "focus:shadow-[0_0_0_3px_rgba(212,165,116,0.1)]",
].join(" ");

const labelCls = "block text-xs uppercase tracking-wider text-white/60 mb-2";

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
      <h1 className="font-display text-3xl md:text-4xl tracking-tight mb-2">
        Vaše údaje
      </h1>
      <p className="text-white/60 mb-8">
        Potvrzení a odkaz na zrušení vám pošleme na e-mail.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) {
            onSubmit({ name: name.trim(), phone, email: email.trim() });
          }
        }}
        className="space-y-5 md:space-y-6 max-w-md"
      >
        <label className="block">
          <span className={labelCls}>
            Jméno <span className="text-[var(--color-accent)]">*</span>
          </span>
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
          <span className={labelCls}>
            Telefon <span className="text-[var(--color-accent)]">*</span>{" "}
            <span className="normal-case tracking-normal text-white/40">
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
            <span className="block text-xs text-[var(--color-danger)] mt-1.5">
              Formát E.164: + a 8–15 číslic (např. +420600100200)
            </span>
          )}
        </label>

        <label className="block">
          <span className={labelCls}>
            E-mail <span className="text-[var(--color-accent)]">*</span>
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            autoComplete="email"
            required
          />
        </label>

        <label className="flex items-start gap-3 cursor-pointer group mt-6 md:mt-8">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="sr-only"
            required
          />
          <span
            className={cn(
              "mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all duration-200 shrink-0",
              consent
                ? "bg-[var(--color-accent)] border-[var(--color-accent)]"
                : "border-white/20 bg-white/[0.03] group-hover:border-white/40",
            )}
          >
            {consent && (
              <svg
                className="w-3 h-3 text-[var(--color-bg-base)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
            )}
          </span>
          <span className="text-sm text-white/70 group-hover:text-white transition-colors">
            Souhlasím se zpracováním osobních údajů pro účely rezervace.
            Jméno, telefon a e-mail jsou uloženy odděleně od veřejných dat
            o rezervaci (PII split).
          </span>
        </label>

        <div className="mt-8 md:mt-10 pt-6 border-t border-white/10 flex items-center justify-between">
          <button type="button" onClick={onPrev} className="btn-ghost">
            ← Zpět
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "px-8 py-3 rounded-full font-medium transition-all duration-300",
              "bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-deep)]",
              "text-[var(--color-bg-base)]",
              "shadow-[0_10px_30px_rgba(212,165,116,0.3)]",
              "hover:scale-105",
              "disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed",
            )}
          >
            Pokračovat →
          </button>
        </div>
      </form>
    </div>
  );
}
