# Session handoff — Day 5 FINAL (2026-05-24 EOD)

**Branch:** `main` · **Last commit před tímto:** `f7bcb05` · **Tree:** clean.

Case study delivery **COMPLETE**. Live URL: **https://hair-salon-booking-cs-69a08.web.app**.

Předchozí handoff: [`SESSION_HANDOFF_2026-05-24-DAY5_PREFLIGHT.md`](SESSION_HANDOFF_2026-05-24-DAY5_PREFLIGHT.md) (Day 5 morning, pre-T1). Day 4 EOD: [`SESSION_HANDOFF_2026-05-23.md`](SESSION_HANDOFF_2026-05-23.md).

---

## Day 5 commit chain

| Commit | Title | Scope |
|---|---|---|
| `4548d0a` | `chore(docs): Day 5 morning preflight handoff` | Cesta B chosen, ready for T1 |
| `4f22039` | `fix(rules): allow public list absences for slot picker` | Smoke A fix — `permission-denied` na slot picker |
| `1eb9571` | `docs: post-smoke doc drift cleanup` | Cesta B path, Java 21+, 9 svc, absences public |
| `6898c3e` | `feat(seed): production target support` | `--target=production` + upsert auth + ADC + prompt |
| `f7bcb05` | `fix(web): production Firebase config` | Real apiKey/appId/etc., emulator switching preserved |
| `<this>` | `docs: production deploy URL` | README header + §4 + §13 + CLAUDE.md §5 reflect deployed state |

## Live state

- **Hosting:** https://hair-salon-booking-cs-69a08.web.app
- **Region:** Firestore eur3 + Auth + Functions europe-west3 + Hosting global edge
- **Plan:** Blaze (required for Cloud Functions Gen2)
- **Admin credentials:** see [`README §5`](../README.md#5-přihlašovací-údaje-seedovaní-admini) — 6 účtů (eva@/marie@/lenka@/petra@/tereza@/hana@salon.cz), password `Heslo123!`
- **Data:** 9 services + 5 stylists + ~25 bookings + 6 absences + customerProfiles + notifications, seeded via `npm run seed:prod`

## Verified e2e (live URL)

- ✅ Public booking flow — service select → slot picker (anyone-mode) → customer form → submit
- ✅ Admin login — `eva@salon.cz` owner role → sidebar 5 položek → /admin/dashboard
- ✅ Composite indexes operational — bookings (stylistId, startAt) + absences (stylistId, endAt) — built first per D-018 deploy sekvence
- ✅ Cloud Functions callable — createBooking + manageBookingByToken
- ✅ Firestore rules — claims-based, deny-by-default + per-collection ACL per D-013

## Známé limitace (per README §9)

- **§9.1** `npm audit` low severity warnings (Firebase deps, vědomě s nimi žijeme)
- **§9.2** `EBADENGINE` na Node 24 (functions cloud runtime = 22, lokál 24 OK)
- **§9.3** Runtime smoke gap **closed** — 8/8 PASS lokálně + e2e PASS live
- **§9.4** Architektonický debt D1-D5 (žádné blockery, cleanup candidates)
- **§9.5** JS bundle 646kb (Firebase SDK dominantní, code-split kandidát)
- **§9.6** Default Vite `<title>` (drobnost, polish item)
- **§9.7** Phase 3.5 reports placeholder (deferred per shipper mode)

## Future work (per README §7)

V přibližném pořadí přínosu: functions vitest integration, real-time admin rozvrh (onSnapshot), Phase 3.5 reports dashboard, no-show decay formula, customer recognition (phoneHash lookup), code-splitting, lunch breaks, buffer mezi rezervacemi, configurable slot granularity, pre-computed availability cache, multi-stylist booking, „rezervovat stejné jako minule", E2E Playwright, audit log, App Check, walk-in GDPR polish.

## Co bych v produkci udělal jinak (README §8)

E-mail = Resend.com, SMS = Twilio nebo SMSbrana, platby = GoPay nebo Stripe, cancellation policy enforcement, App Check + reCAPTCHA Enterprise, rate limiting at CF, Sentry + structured logging, CI/CD GitHub Actions, staging environment, CF cold start tuning, `--enable-source-maps`, D1-D5 debt cleanup, BookingView typ lift.

## Workflow norms validated this session

- **Calibrated rebellion bidirectional** — Claude opatrnost s Java 21+ correctní instinkt (nedezinformovat docs bez source), user empirie correct (T1 PowerShell output je authoritative). Both directions of audit mattered.
- **Honest commit messages** — `f7bcb05` explicitly logs Web App config gap rationale; trade-off table v body explaining hardcoded vs env-vars choice. No overclaim.
- **Pre-flight discipline (L-010)** — pre-deploy Java check + port check + workspace install verify catch-nul missing Docker upfront; saved time vs runtime discovery.
- **Audit-first per L-007** — production seed support + Firebase config switch oboje proposed → audit table → apply. Žádný silent ship.
- **Shipper mode for docs** — final URL update commit minimal-discussion, mechanical.

## Submission ready

- ✅ README §13 audit checklist — všechny ✅ kromě 2 explicit ⚠️ deferred (Phase 3.5 reports, walk-in GDPR polish) per §7 future work
- ✅ Live URL operational + e2e verified
- ✅ Production seed run + admin credentials documented
- ✅ AI disclosure §11 + commits Co-Authored-By: Claude footer
- ✅ Architectural decisions D-001 → D-018 documented v `docs/decisions.md`
- ✅ Lessons learned L-001 → L-010 documented v `docs/LESSONS_LEARNED.md`
- ✅ Feedback PR draft v `docs/PR_DRAFT.md` per §12

Repo state: **ready for case study submission**.
