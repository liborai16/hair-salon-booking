import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { UserRole } from "@hsb/shared";
import { useAuth } from "../lib/auth";

type Props = {
  children: ReactNode;
  /** When set, the user must hold this exact role; otherwise rendered as
   *  a forbidden notice. Use for owner-only sub-routes (stylists / services /
   *  reports). For staff-broad gating, omit and rely on isStaff at the
   *  nav-filter layer (defense-in-depth: rules also gate). */
  requireRole?: UserRole;
};

export function RequireAuth({ children, requireRole }: Props) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "loading") {
    return <div className="text-stone-500 p-6">Načítám…</div>;
  }
  if (auth.status === "unauthenticated") {
    return (
      <Navigate to="/admin/login" state={{ from: location }} replace />
    );
  }
  if (requireRole && auth.role !== requireRole) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 max-w-md">
        Tato stránka vyžaduje roli „{requireRole}". Vaše role: „{auth.role}".
      </div>
    );
  }
  return <>{children}</>;
}
