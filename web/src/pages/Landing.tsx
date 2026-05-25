import { Link } from "react-router-dom";
import BackgroundGradientAnimation from "@/components/ui/aceternity/background-gradient-animation";
import {
  CardBody,
  CardContainer,
  CardItem,
} from "@/components/ui/aceternity/3d-card";
import { cn } from "@/lib/cn";

// Team data — names + roles from scripts/seed.mjs (5 stylists incl. owner).
const TEAM_MEMBERS = [
  {
    id: "owner",
    initials: "EN",
    name: "Eva Nováková",
    role: "Majitelka",
    description:
      "Majitelka studia. Specializuje se na střihy „na míru\" a komplexní proměny. 15 let zkušeností v oboru.",
    accentColor: "lavender" as const,
  },
  {
    id: "stylist-mistrova",
    initials: "MK",
    name: "Marie Krásná",
    role: "Mistrová",
    description:
      "Balayage a barevné přechody jsou její doména. Klienti si rezervují i měsíc dopředu.",
    accentColor: null,
  },
  {
    id: "stylist-senior-1",
    initials: "LS",
    name: "Lenka Svobodová",
    role: "Senior",
    description:
      "Klasické dámské střihy, foukané. Ranní termíny pondělí až pátek.",
    accentColor: null,
  },
  {
    id: "stylist-senior-2",
    initials: "PD",
    name: "Petra Dvořáková",
    role: "Senior",
    description:
      "Odpolední a sobotní termíny. Klidná atmosféra pro klienty, co mají z kadeřnictví obavy.",
    accentColor: null,
  },
  {
    id: "stylist-junior",
    initials: "TM",
    name: "Tereza Malá",
    role: "Junior",
    description:
      "Pánské střihy a běžné dámské. V salonu nejmladší — energie i ruka.",
    accentColor: null,
  },
];

const PRICE_CATEGORIES = [
  {
    id: "panske",
    name: "Pánské střihy",
    services: [
      { name: "Pánské holení", duration: "15 min", price: "od 200 Kč" },
      { name: "Pánský střih", duration: "30 min", price: "od 350 Kč" },
    ],
  },
  {
    id: "damske",
    name: "Dámské střihy",
    services: [
      { name: "Dámský střih (krátké vlasy)", duration: "30 min", price: "450 Kč" },
      { name: "Dámský střih (dlouhé vlasy)", duration: "45 min", price: "550 Kč" },
    ],
  },
  {
    id: "detske",
    name: "Dětské střihy",
    services: [
      { name: "Dětský střih", duration: "20 min", price: "250 Kč" },
    ],
  },
  {
    id: "barveni",
    name: "Barvení",
    services: [
      { name: "Barva — základní", duration: "60 min", price: "od 700 Kč" },
      { name: "Melír / balayage", duration: "150 min", price: "od 1 500 Kč" },
    ],
  },
  {
    id: "foukana",
    name: "Foukaná",
    services: [{ name: "Foukaná", duration: "30 min", price: "350 Kč" }],
  },
  {
    id: "osetreni",
    name: "Ošetření",
    services: [
      { name: "Regenerační ošetření", duration: "45 min", price: "600 Kč" },
    ],
  },
  {
    id: "svatebni",
    name: "Svatební styling",
    services: [
      { name: "Svatební styling", duration: "120 min", price: "2 500 Kč" },
    ],
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Chodím tu skoro rok a Eva mě vždycky pochopí, i když přijdu s mlhavou představou. Naprostá spokojenost.",
    author: "Klára P.",
    initials: "KP",
  },
  {
    quote:
      "Pánský střih bez čekání, profesionálně a v pohodové atmosféře. Doporučuji všem chlapům, kteří nemají čas na nesmysly.",
    author: "Tomáš H.",
    initials: "TH",
  },
  {
    quote:
      "Vzala jsem syna na dětský střih a kadeřnice s ním měla anděla. Vrátíme se i s manželem.",
    author: "Aneta V.",
    initials: "AV",
  },
];

/**
 * Landing — Cinematic Wellness Luxury edition (Phase 8.3.B).
 *
 * Fullscreen scroll-snap composition: 5 sections, each min-h-screen
 * (final 80vh). Asymmetric editorial layouts, full-bleed Spotlight,
 * single primary CTA per surface, dark theme.
 *
 * Outer wrapper is <div> (not <main>) because Layout already provides
 * the page's <main> landmark wrapping <Outlet />.
 */
export function Landing() {
  return (
    <div>
      <Section1Hero />
      <Section2Trust />
      <Section3Services />
      <Section4HowItWorks />
      <Section5Tym />
      <Section6Cenik />
      <Section7Reference />
      <Section8Kontakt />
      <Section9CTAFinale />
    </div>
  );
}

function Section1Hero() {
  return (
    <section
      id="home"
      className="min-h-screen pt-24 md:pt-32 relative overflow-hidden flex items-center"
    >
      <BackgroundGradientAnimation interactive />

      <div className="relative z-10 container mx-auto max-w-7xl px-6 md:px-12">
        <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-8 md:mb-12">
          Kadeřnický salon · Praha
        </div>

        <h1 className="font-display font-medium tracking-tight leading-[0.95]">
          <span className="block text-[clamp(56px,12vw,160px)]">
            Vlasy, kterým budete
          </span>
          <span className="block text-[clamp(56px,12vw,160px)] italic text-[var(--color-accent)] mt-2">
            věřit<span className="text-white">.</span>
          </span>
        </h1>

        <p className="mt-12 md:mt-16 text-[clamp(16px,1.8vw,20px)] text-white/60 max-w-2xl">
          Malé pražské studio, kde se kadeřnictví dělá s péčí a nepospícháme.
          Pět kadeřnic, jedna židle pro každou, žádné nahánění.
        </p>

        <div className="mt-12 md:mt-16 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <Link
            to="/book"
            className="inline-flex items-center gap-2 px-10 py-5 rounded-full text-white text-base md:text-lg font-medium bg-gradient-to-r from-[var(--color-accent)] to-violet-500 shadow-[0_20px_60px_rgba(139,92,246,0.4)] hover:scale-105 transition-transform"
          >
            Rezervovat termín
            <span className="text-xl">→</span>
          </Link>
          <a
            href="#tym"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("tym")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 px-10 py-5 rounded-full text-white/80 text-base md:text-lg font-medium border border-white/20 hover:border-white/40 hover:text-white transition-colors"
          >
            Seznámit se s týmem
          </a>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-xs tracking-widest">
        ↓ ZJISTIT VÍCE
      </div>
    </section>
  );
}

function Section2Trust() {
  return (
    <section
      id="o-nas"
      className="min-h-screen pt-24 md:pt-32 pb-16 md:pb-20 relative overflow-hidden flex items-center"
    >
      <div className="container mx-auto max-w-7xl px-6 md:px-12 w-full">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-accent)]/70 mb-6">
          Kdo jsme
        </div>
        <h2 className="font-display font-medium tracking-tight leading-[1.05] text-[clamp(40px,7vw,80px)] mb-8 md:mb-12 max-w-4xl">
          Studio, kde{" "}
          <span className="italic text-[var(--color-accent)]">
            nepospícháme
          </span>
          .
        </h2>
        <p className="text-white/70 text-lg md:text-xl leading-relaxed max-w-2xl mb-16 md:mb-20">
          Vznikli jsme z myšlenky, že kadeřnictví má být místo, kde si klient
          odpočine — nejen jen práce nad hlavou. Pět kadeřnic, jeden tým, žádný
          stres mezi termíny.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          <USPCard
            title="15 let zkušeností"
            description="Majitelka Eva je v oboru déle, než trvá většina trendů. Vyzná se v klasice i v experimentech."
          />
          <USPCard
            title="Olaplex partner"
            description="Pro klienty s odbarvenými vlasy používáme Olaplex přímo v ceně služby — žádné skryté příplatky."
          />
          <USPCard
            title="Online rezervace"
            description="Volné termíny vidíte v reálném čase. Žádné telefonáty, žádné čekání. Zrušíte jedním klikem z mobilu."
          />
        </div>
      </div>
    </section>
  );
}

function USPCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-l-2 border-[var(--color-accent)]/40 pl-6">
      <h3 className="font-display text-2xl md:text-3xl font-medium tracking-tight mb-3">
        {title}
      </h3>
      <p className="text-white/60 text-base md:text-lg leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function Section3Services() {
  return (
    <section
      id="sluzby"
      className="min-h-screen pt-24 md:pt-32 pb-16 md:pb-20 relative overflow-hidden flex items-center"
    >
      <div className="container mx-auto max-w-7xl px-6 md:px-12 w-full">
        <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-6">
          Naše služby
        </div>
        <h2 className="font-display font-medium tracking-tight leading-[1.05] text-[clamp(40px,7vw,80px)] mb-16 md:mb-24">
          Co pro vás <span className="italic text-[var(--color-accent)]">uděláme</span>.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mt-8 md:mt-12">
          <div className="md:h-[340px] h-[220px]">
            <ServiceCard3D title="Stříhání" eyebrow="01" />
          </div>
          <div className="md:h-[340px] h-[220px]">
            <ServiceCard3D title="Barvení" eyebrow="02" />
          </div>
          <div className="md:h-[280px] h-[200px]">
            <ServiceCard3D title="Foukaná" eyebrow="03" />
          </div>
          <div className="md:h-[280px] h-[200px]">
            <ServiceCard3D title="Dětský střih" eyebrow="04" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ServiceCard3D({
  title,
  eyebrow,
}: {
  title: string;
  eyebrow: string;
}) {
  return (
    <CardContainer containerClassName="!py-0 h-full" className="h-full w-full">
      <CardBody
        className={cn(
          "h-full w-full rounded-2xl md:rounded-3xl",
          "bg-white/[0.04] backdrop-blur-xl border border-white/[0.08]",
          "shadow-[0_20px_60px_rgba(0,0,0,0.3)]",
          "hover:bg-white/[0.06] hover:border-[var(--color-accent)]/30 transition-colors",
          "p-6 md:p-8 flex flex-col justify-end",
        )}
      >
        <CardItem
          translateZ={20}
          className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2"
        >
          {eyebrow}
        </CardItem>
        <CardItem
          as="h3"
          translateZ={50}
          className="font-display text-[clamp(24px,3vw,40px)] font-medium tracking-tight"
        >
          {title}
        </CardItem>
      </CardBody>
    </CardContainer>
  );
}

function Section4HowItWorks() {
  return (
    <section
      id="jak-to-funguje"
      className="min-h-screen pt-24 md:pt-32 pb-16 md:pb-20 relative overflow-hidden flex items-center"
    >
      <div className="container mx-auto max-w-7xl px-6 md:px-12 w-full">
        <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-6">
          Jak to funguje
        </div>
        <h2 className="font-display font-medium tracking-tight leading-[1.05] text-[clamp(40px,7vw,80px)] mb-16 md:mb-24">
          Tři kroky k <span className="italic text-[var(--color-accent)]">termínu</span>.
        </h2>

        {/* TODO Phase 8.3.E: Add Tracing Beam + Timeline component */}
        <div className="space-y-16 md:space-y-24 max-w-3xl">
          <Step
            number="01"
            title="Vyberte si službu"
            description="Stříhání, barvení, foukaná, ošetření. Kombinace povoleny."
          />
          <Step
            number="02"
            title="Najděte volný termín"
            description="Filtruj podle kadeřníka nebo nechej 'kdokoliv' a uvidíš všechny sloty."
          />
          <Step
            number="03"
            title="Zarezervujte"
            description="E-mail + telefon. Bez registrace. Potvrzení do minuty."
          />
        </div>
      </div>
    </section>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-8 md:gap-12 items-start">
      <div className="font-display text-[clamp(64px,8vw,120px)] leading-none text-[var(--color-accent)] opacity-40">
        {number}
      </div>
      <div className="pt-2 md:pt-6">
        <h3 className="font-display text-[clamp(24px,3vw,36px)] font-medium tracking-tight mb-3">
          {title}
        </h3>
        <p className="text-white/60 text-[clamp(15px,1.5vw,18px)] max-w-md">
          {description}
        </p>
      </div>
    </div>
  );
}

function Section5Tym() {
  return (
    <section
      id="tym"
      className="min-h-screen pt-24 md:pt-32 pb-16 md:pb-20 relative overflow-hidden flex items-center"
    >
      <div className="container mx-auto max-w-7xl px-6 md:px-12 w-full">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-accent)]/70 mb-6">
          Náš tým
        </div>
        <h2 className="font-display font-medium tracking-tight leading-[1.05] text-[clamp(40px,7vw,80px)] mb-6 max-w-4xl">
          Pět rukou,{" "}
          <span className="italic text-[var(--color-accent)]">
            pět příběhů
          </span>
          .
        </h2>
        <p className="text-white/70 text-lg md:text-xl leading-relaxed max-w-2xl mb-16 md:mb-20">
          Každá kadeřnice má svoji specializaci. Rezervační systém vám ukáže
          jen ty, které mohou udělat to, co potřebujete.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {TEAM_MEMBERS.map((member) => (
            <TeamCard key={member.id} member={member} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TeamCard({ member }: { member: (typeof TEAM_MEMBERS)[0] }) {
  return (
    <div
      className={cn(
        "rounded-2xl p-6 md:p-8 backdrop-blur-xl border transition-colors",
        "bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.3)]",
        member.accentColor === "lavender"
          ? "border-[var(--color-accent)]/30 hover:border-[var(--color-accent)]/50"
          : "border-white/[0.08] hover:border-[var(--color-accent)]/30",
        "hover:bg-white/[0.06]",
      )}
    >
      <div
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center mb-6 font-display text-sm tracking-wide",
          member.accentColor === "lavender"
            ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
            : "bg-white/[0.08] text-white/80",
        )}
      >
        {member.initials}
      </div>
      <h3 className="font-display text-2xl font-medium tracking-tight mb-1">
        {member.name}
      </h3>
      <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-4">
        {member.role}
      </div>
      <p className="text-white/60 text-sm md:text-base leading-relaxed">
        {member.description}
      </p>
    </div>
  );
}

function Section6Cenik() {
  return (
    <section
      id="cenik"
      className="min-h-screen pt-24 md:pt-32 pb-16 md:pb-20 relative overflow-hidden flex items-center"
    >
      <div className="container mx-auto max-w-7xl px-6 md:px-12 w-full">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-accent)]/70 mb-6">
          Ceník
        </div>
        <h2 className="font-display font-medium tracking-tight leading-[1.05] text-[clamp(40px,7vw,80px)] mb-6 max-w-4xl">
          Co <span className="italic text-[var(--color-accent)]">nabízíme</span>.
        </h2>
        <p className="text-white/70 text-lg md:text-xl leading-relaxed max-w-2xl mb-16 md:mb-20">
          U barvení záleží cena na délce vlasů — uvidíte ji při výběru v
          rezervaci. Všechny ceny jsou orientační, finální cenu řeší recepce
          po dohodě s kadeřnicí.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-12">
          {PRICE_CATEGORIES.map((c) => (
            <PriceCategoryCard key={c.id} category={c} />
          ))}
        </div>
        <div className="flex justify-center">
          <Link
            to="/book"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.12] hover:border-[var(--color-accent)]/40 transition-all text-white font-medium tracking-wide"
          >
            Vybrat termín →
          </Link>
        </div>
      </div>
    </section>
  );
}

function PriceCategoryCard({
  category,
}: {
  category: (typeof PRICE_CATEGORIES)[0];
}) {
  return (
    <div className="rounded-2xl p-6 md:p-8 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] hover:border-[var(--color-accent)]/30 transition-colors">
      <h3 className="font-display text-2xl font-medium tracking-tight mb-6 pb-4 border-b border-white/[0.08]">
        {category.name}
      </h3>
      <ul className="space-y-4">
        {category.services.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <div>
              <div className="text-white/90 text-base md:text-lg">{s.name}</div>
              <div className="text-white/40 text-xs">{s.duration}</div>
            </div>
            <div className="text-white font-medium tabular-nums whitespace-nowrap">
              {s.price}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section7Reference() {
  return (
    <section
      id="reference"
      className="min-h-screen pt-24 md:pt-32 pb-16 md:pb-20 relative overflow-hidden flex items-center"
    >
      <div className="container mx-auto max-w-7xl px-6 md:px-12 w-full">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-accent)]/70 mb-6">
          Reference
        </div>
        <h2 className="font-display font-medium tracking-tight leading-[1.05] text-[clamp(40px,7vw,80px)] mb-16 md:mb-20 max-w-4xl">
          Co o nás <span className="italic text-[var(--color-accent)]">říkají</span>.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={i} testimonial={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({
  testimonial,
}: {
  testimonial: (typeof TESTIMONIALS)[0];
}) {
  return (
    <div className="rounded-2xl p-6 md:p-8 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] hover:border-[var(--color-accent)]/30 transition-colors flex flex-col">
      <div className="flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className="text-[var(--color-accent)] text-lg">
            ★
          </span>
        ))}
      </div>
      <p className="text-white/80 text-base md:text-lg leading-relaxed italic mb-6 flex-1">
        „{testimonial.quote}"
      </p>
      <div className="flex items-center gap-3 pt-4 border-t border-white/[0.08]">
        <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center text-xs font-medium text-white/80">
          {testimonial.initials}
        </div>
        <div className="text-white/70 text-sm">{testimonial.author}</div>
      </div>
    </div>
  );
}

function Section8Kontakt() {
  return (
    <section
      id="kontakt"
      className="min-h-screen pt-24 md:pt-32 pb-16 md:pb-20 relative overflow-hidden flex items-center"
    >
      <div className="container mx-auto max-w-7xl px-6 md:px-12 w-full">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-accent)]/70 mb-6">
          Kontakt
        </div>
        <h2 className="font-display font-medium tracking-tight leading-[1.05] text-[clamp(40px,7vw,80px)] mb-16 md:mb-20 max-w-4xl">
          Najdete nás{" "}
          <span className="italic text-[var(--color-accent)]">v Praze</span>.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
          <div className="space-y-7">
            <ContactRow
              label="Adresa"
              value={"Náměstí Míru 5\n120 00 Praha 2"}
            />
            <ContactRow
              label="Telefon"
              value="+420 222 333 444"
              href="tel:+420222333444"
            />
            <ContactRow
              label="E-mail"
              value="studio@salon.cz"
              href="mailto:studio@salon.cz"
            />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">
                Otevírací doba
              </div>
              <div className="grid grid-cols-[80px,1fr] gap-y-2 text-white/80 text-base md:text-lg">
                <div>Po-Pá</div>
                <div>9:00 — 20:00</div>
                <div>So</div>
                <div>9:00 — 15:00</div>
                <div>Ne</div>
                <div className="text-white/40">Zavřeno</div>
              </div>
            </div>
            <div className="pt-4">
              <Link
                to="/book"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-black font-medium tracking-wide transition-all"
              >
                Rezervovat online →
              </Link>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-white/[0.08] h-[400px] md:h-[500px] bg-white/[0.02]">
            <iframe
              src="https://www.openstreetmap.org/export/embed.html?bbox=14.4328%2C50.0748%2C14.4428%2C50.0798&layer=mapnik&marker=50.0773%2C14.4378"
              title="Mapa - Studio, Náměstí Míru 5, Praha 2"
              className="w-full h-full border-0 [filter:invert(1)_hue-rotate(180deg)_brightness(0.95)_contrast(0.9)]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="whitespace-pre-line text-white/80 text-base md:text-lg hover:text-[var(--color-accent)] transition-colors">
      {value}
    </div>
  );
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">
        {label}
      </div>
      {href ? <a href={href}>{content}</a> : content}
    </div>
  );
}

function Section9CTAFinale() {
  return (
    <section className="min-h-screen pt-24 md:pt-32 pb-16 md:pb-20 relative overflow-hidden flex items-center justify-center">
      <BackgroundGradientAnimation interactive />

      <div className="relative z-10 container mx-auto max-w-4xl px-6 md:px-12 text-center">
        <h2 className="font-display font-medium tracking-tight leading-[0.95] text-[clamp(56px,11vw,140px)]">
          Pojďme to
          <span className="block italic text-[var(--color-accent)] mt-2">
            udělat.
          </span>
        </h2>

        <div className="mt-12 md:mt-16">
          <Link
            to="/book"
            className="inline-flex items-center gap-3 px-12 py-6 rounded-full text-white text-lg md:text-xl font-medium bg-gradient-to-r from-[var(--color-accent)] to-violet-500 shadow-[0_30px_80px_rgba(139,92,246,0.5)] hover:scale-105 transition-transform"
          >
            Rezervovat termín
            <span className="text-2xl">→</span>
          </Link>
        </div>

        <p className="mt-8 text-white/40 text-sm">
          Bez registrace · 1 minuta · Potvrzení e-mailem
        </p>
      </div>
    </section>
  );
}
