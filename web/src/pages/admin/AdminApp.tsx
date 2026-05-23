import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "../../components/RequireAuth";
import { AdminLayout } from "./AdminLayout";
import { AdminLogin } from "./AdminLogin";
import { DailySchedule } from "./DailySchedule";
import { AdminWalkIn } from "./AdminWalkIn";

/**
 * Admin routing — nested under `/admin/*` from App.tsx.
 *
 * Public: /admin/login
 * Protected (any role): /admin/dashboard, /admin/walk-in
 * Owner-only: /admin/stylists, /admin/services, /admin/reports
 *
 * RequireAuth at the parent level handles auth presence; per-route
 * `requireRole` adds the owner gate for management screens. The layout
 * sidebar additionally hides owner-only links from non-owners (UX +
 * defense-in-depth, but rules are the actual gate).
 *
 * Phase 3.1 ships login + layout + protected routing; child pages are
 * placeholders. Dashboard (Phase 3.2), walk-in (3.3), CRUD (3.4),
 * reports (3.5) replace them.
 */
function Placeholder({ name, hint }: { name: string; hint: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">{name}</h1>
      <p className="text-stone-500">{hint}</p>
    </div>
  );
}

export function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />
      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DailySchedule />} />
        <Route path="walk-in" element={<AdminWalkIn />} />
        <Route
          path="stylists"
          element={
            <RequireAuth requireRole="owner">
              <Placeholder
                name="Kadeřníci"
                hint="CRUD kadeřníků je v přípravě (Phase 3.4)."
              />
            </RequireAuth>
          }
        />
        <Route
          path="services"
          element={
            <RequireAuth requireRole="owner">
              <Placeholder
                name="Služby"
                hint="CRUD služeb je v přípravě (Phase 3.4)."
              />
            </RequireAuth>
          }
        />
        <Route
          path="reports"
          element={
            <RequireAuth requireRole="owner">
              <Placeholder
                name="Přehledy"
                hint="Přehledy jsou v přípravě (Phase 3.5)."
              />
            </RequireAuth>
          }
        />
      </Route>
    </Routes>
  );
}
