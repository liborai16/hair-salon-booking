import { Link } from "react-router-dom";
import BackgroundGradientAnimation from "@/components/ui/aceternity/background-gradient-animation";
import {
  CardBody,
  CardContainer,
  CardItem,
} from "@/components/ui/aceternity/3d-card";
import { cn } from "@/lib/cn";

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
    <div className="snap-y snap-mandatory h-screen overflow-y-scroll">
      <Section1Hero />
      <Section2Trust />
      <Section3Services />
      <Section4HowItWorks />
      <Section5CTAFinale />
    </div>
  );
}

function Section1Hero() {
  return (
    <section className="snap-start min-h-screen relative overflow-hidden flex items-center">
      <BackgroundGradientAnimation interactive />

      <div className="relative z-10 container mx-auto max-w-7xl px-6 md:px-12">
        <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-8 md:mb-12">
          Kadeřnický salon · Praha
        </div>

        <h1 className="font-display font-medium tracking-tight leading-[0.95]">
          <span className="block text-[clamp(56px,12vw,160px)]">
            Vlasy, na které si
          </span>
          <span className="block text-[clamp(56px,12vw,160px)] italic text-[var(--color-accent)] mt-2">
            vzpomenete<span className="text-white">.</span>
          </span>
        </h1>

        <p className="mt-12 md:mt-16 text-[clamp(16px,1.8vw,20px)] text-white/60 max-w-2xl">
          Rezervujte si termín online za pár sekund. Bez čekání na recepci,
          bez registrace.
        </p>

        <div className="mt-12 md:mt-16">
          <Link
            to="/book"
            className="inline-flex items-center gap-2 px-10 py-5 rounded-full text-white text-base md:text-lg font-medium bg-gradient-to-r from-[var(--color-accent)] to-violet-500 shadow-[0_20px_60px_rgba(139,92,246,0.4)] hover:scale-105 transition-transform"
          >
            Rezervovat termín
            <span className="text-xl">→</span>
          </Link>
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
    <section className="snap-start min-h-screen relative overflow-hidden flex items-center">
      <div className="container mx-auto max-w-7xl px-6 md:px-12">
        <div className="grid md:grid-cols-12 gap-12 md:gap-20 items-center">
          <div className="md:col-span-7">
            <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-6">
              Proč nás
            </div>
            <h2 className="font-display font-medium tracking-tight leading-[1.05] text-[clamp(40px,7vw,80px)]">
              Stvořeno pro pohodlí klientů
              <span className="italic text-[var(--color-accent)]"> i salonu.</span>
            </h2>
            <p className="mt-8 text-[clamp(16px,1.8vw,20px)] text-white/60 max-w-xl">
              Online rezervace bez čekání. Tým 5 kadeřníků. Transparentní cena
              bez překvapení.
            </p>
          </div>

          <div className="md:col-span-5 space-y-8 md:space-y-12">
            <Metric value="5" label="Kadeřníků" />
            <Metric value="9" label="Služeb" />
            <Metric value="14" label="Dní napřed" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-l border-white/10 pl-6">
      <div className="font-display text-[clamp(56px,8vw,96px)] leading-none">
        {value}
      </div>
      <div className="text-xs uppercase tracking-[0.2em] text-white/40 mt-2">
        {label}
      </div>
    </div>
  );
}

function Section3Services() {
  return (
    <section className="snap-start min-h-screen relative overflow-hidden flex items-center">
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
    <section className="snap-start min-h-screen relative overflow-hidden flex items-center">
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

function Section5CTAFinale() {
  return (
    <section className="snap-start min-h-[80vh] relative overflow-hidden flex items-center justify-center">
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
