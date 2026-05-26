import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "../../components/RequireAuth";
import { AdminLayout } from "./AdminLayout";
import { AdminLogin } from "./AdminLogin";
import { DailySchedule } from "./DailySchedule";
import { AdminWalkIn } from "./AdminWalkIn";
import { StylistsPage } from "./StylistsPage";
import { ServicesPage } from "./ServicesPage";
import { ReportsPage } from "./ReportsPage";

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
 * Reports is currently an editorial empty-state page (Phase 8.5.1) —
 * backend data layer ready, UI aggregation deferred per scope.
 */
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
              <StylistsPage />
            </RequireAuth>
          }
        />
        <Route
          path="services"
          element={
            <RequireAuth requireRole="owner">
              <ServicesPage />
            </RequireAuth>
          }
        />
        <Route
          path="reports"
          element={
            <RequireAuth requireRole="owner">
              <ReportsPage />
            </RequireAuth>
          }
        />
      </Route>
    </Routes>
  );
}
