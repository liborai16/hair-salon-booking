import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import type { UserRole } from "@hsb/shared";
import { signOutAdmin, useAuth } from "../../lib/auth";

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Majitelka",
  receptionist: "Recepční",
  stylist: "Kadeřník/Kadeřnice",
};

export function AdminLayout() {
  const auth = useAuth();
  // RequireAuth wrapping ensures we never render in unauthenticated state,
  // but TS narrowing needs the explicit guard.
  if (auth.status !== "authenticated") return null;

  const isOwner = auth.role === "owner";
  const isStaff = auth.role === "owner" || auth.role === "receptionist";

  return (
    <div className="min-h-screen flex bg-stone-50">
      <aside className="w-56 bg-white border-r border-stone-200 flex flex-col">
        <div className="px-4 py-4 border-b border-stone-200">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Salon Krásná
          </Link>
          <div className="text-xs text-stone-500 mt-1">Administrace</div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          <NavItem to="/admin/dashboard">Rozvrh</NavItem>
          {isStaff && <NavItem to="/admin/walk-in">Nová rezervace</NavItem>}
          {isOwner && <NavItem to="/admin/stylists">Kadeřníci</NavItem>}
          {isOwner && <NavItem to="/admin/services">Služby</NavItem>}
          {isOwner && <NavItem to="/admin/reports">Přehledy</NavItem>}
        </nav>
        <div className="border-t border-stone-200 px-4 py-4 text-xs text-stone-500">
          <div className="font-medium text-stone-700">{auth.user.email}</div>
          <div>{ROLE_LABELS[auth.role]}</div>
          <button
            type="button"
            onClick={() => void signOutAdmin()}
            className="mt-3 text-stone-500 hover:text-stone-900"
          >
            Odhlásit
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block px-3 py-2 rounded-md text-sm ${
          isActive
            ? "bg-stone-900 text-white"
            : "text-stone-700 hover:bg-stone-100"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
