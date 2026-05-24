import { Link } from "react-router-dom";

/**
 * Landing — public marketing surface. Modern luxe theme: charcoal +
 * champagne on white, Fraunces display + Inter body + JetBrains Mono
 * labels. No hero photography — typography-driven editorial layout.
 *
 * Sections:
 *  1. Hero          (full-bleed display H1 + dual CTA + meta strip)
 *  2. Value props   (3-column "Proč nás" with numbered labels)
 *  3. Services      (typography preview grid + bridge CTA)
 *  4. Dark CTA band (charcoal section + inverted CTA)
 */
export function Landing() {
  return (
    <>
      <Hero />
      <ValueProps />
      <ServicesPreview />
      <CtaBand />
    </>
  );
}

function Hero() {
  return (
    <section className="container mx-auto max-w-6xl px-4 pt-12 pb-16 md:pt-20 md:pb-28">
      <div className="label-mono mb-6">
        Kadeřnický salon · Praha
      </div>
      <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight max-w-4xl leading-[1.05]">
        Vlasy, na které si{" "}
        <span className="text-accent-strong italic">vzpomenete</span>.
      </h1>
      <p className="mt-8 text-lg md:text-xl text-muted max-w-2xl leading-relaxed">
        Rezervujte si termín online za pár sekund. Vyberte si službu,
        kadeřníka i čas — bez čekání na recepci, bez registrace.
      </p>
      <div className="mt-10 flex flex-col sm:flex-row gap-3">
        <Link to="/book" className="btn-primary btn-primary-hover">
          Rezervovat termín →
        </Link>
        <a
          href="#proc-nas"
          className="btn-ghost border border-hairline hover:border-fg"
        >
          Jak to funguje
        </a>
      </div>

      <dl className="mt-16 md:mt-20 grid grid-cols-3 gap-6 md:gap-12 max-w-2xl border-t border-hairline pt-8">
        <Stat value="5" label="kadeřníků" />
        <Stat value="9" label="služeb" />
        <Stat value="14" label="dní napřed" />
      </dl>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-4xl md:text-5xl font-medium tracking-tight">
        {value}
      </dt>
      <dd className="mt-2 label-mono">{label}</dd>
    </div>
  );
}

function ValueProps() {
  return (
    <section
      id="proc-nas"
      className="container mx-auto max-w-6xl px-4 py-16 md:py-24 border-t border-hairline"
    >
      <div className="label-mono mb-4">Proč nás</div>
      <h2 className="font-display text-3xl md:text-5xl font-medium tracking-tight max-w-3xl leading-[1.1]">
        Stvořeno pro pohodlí klientů i salonu.
      </h2>
      <div className="mt-12 md:mt-16 grid md:grid-cols-3 gap-10 md:gap-12">
        <ValueCard
          number="01"
          title="Online rezervace"
          body="Vyberte si termín kdykoliv, bez čekání na recepci. Garantovaný slot, e-mail s potvrzením a odkazem pro zrušení."
        />
        <ValueCard
          number="02"
          title="Tým 5 kadeřníků"
          body="Od juniorky po mistrovou s 15 lety praxe. Můžete si vybrat osobu — nebo nechat „kdokoliv“ a vidět všechny volné sloty."
        />
        <ValueCard
          number="03"
          title="Transparentní cena"
          body="Cena podle úrovně kadeřníka. U barvení podle délky vlasů. Žádné překvapení u pokladny."
        />
      </div>
    </section>
  );
}

function ValueCard({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="border-t border-fg pt-6">
      <div className="font-mono text-sm text-muted mb-4">{number}</div>
      <h3 className="font-display text-2xl font-medium tracking-tight mb-3">
        {title}
      </h3>
      <p className="text-muted leading-relaxed">{body}</p>
    </div>
  );
}

const SERVICE_PREVIEW: Array<{ name: string; from: number }> = [
  { name: "Stříhání", from: 400 },
  { name: "Barvení", from: 700 },
  { name: "Foukaná", from: 350 },
  { name: "Ošetření", from: 800 },
  { name: "Dětský střih", from: 300 },
  { name: "Svatební styling", from: 3000 },
];

function ServicesPreview() {
  return (
    <section className="bg-bg-soft border-t border-hairline">
      <div className="container mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="md:flex md:items-end md:justify-between mb-12">
          <div>
            <div className="label-mono mb-4">Naše služby</div>
            <h2 className="font-display text-3xl md:text-5xl font-medium tracking-tight max-w-2xl leading-[1.1]">
              9 služeb. Kombinujte podle libosti.
            </h2>
          </div>
          <Link
            to="/book"
            className="mt-6 md:mt-0 inline-flex items-center gap-2 text-fg hover:text-accent-strong transition group"
          >
            <span className="underline underline-offset-4">
              Zobrazit všechny
            </span>
            <span className="transition group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-hairline">
          {SERVICE_PREVIEW.map((s) => (
            <li
              key={s.name}
              className="border-b border-hairline py-6 px-2 flex items-baseline justify-between gap-3 hover:bg-bg transition"
            >
              <span className="font-display text-lg md:text-xl font-medium tracking-tight min-w-0">
                {s.name}
              </span>
              <span className="label-mono text-fg shrink-0">
                od {s.from} Kč
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="bg-surface text-surface-fg">
      <div className="container mx-auto max-w-6xl px-4 py-20 md:py-32">
        <div className="label-mono text-surface-muted mb-4">
          Připraveni?
        </div>
        <h2 className="font-display text-4xl md:text-6xl lg:text-7xl font-medium tracking-tight max-w-3xl leading-[1.05]">
          Nový{" "}
          <span className="text-accent italic">look</span>{" "}
          na pár kliknutí.
        </h2>
        <p className="mt-6 text-lg text-surface-muted max-w-xl">
          Vyberte si termín a my se postaráme o zbytek.
        </p>
        <Link
          to="/book"
          className="mt-10 inline-flex items-center justify-center bg-bg text-fg px-8 py-3 rounded-md hover:opacity-90 transition font-medium min-h-[44px]"
        >
          Rezervovat termín →
        </Link>
      </div>
    </section>
  );
}
