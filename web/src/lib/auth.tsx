/**
 * Firebase Auth context + helpers.
 *
 * Exposes `useAuth()` returning a discriminated `AuthState` (loading /
 * unauthenticated / authenticated). Subscribes to onAuthStateChanged +
 * onIdTokenChanged so role/claims updates (e.g. after `setCustomUserClaims`
 * server-side) propagate to UI within the next token refresh.
 *
 * Custom claims structure per `seed.mjs` + `firestore.rules`:
 *   { role: 'owner' | 'receptionist' | 'stylist', linkedStylistId?: string }
 *
 * A signed-in user WITHOUT a role claim is treated as unauthenticated —
 * may happen briefly during claims provisioning; UI shouldn't grant
 * admin access in that window.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import type { UserRole } from "@hsb/shared";
import { auth } from "./firebase";

export type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | {
      status: "authenticated";
      user: User;
      role: UserRole;
      linkedStylistId: string | null;
    };

const AuthContext = createContext<AuthState>({ status: "loading" });

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

async function readClaims(
  user: User,
): Promise<{ role?: UserRole; linkedStylistId?: string }> {
  const tokenResult = await user.getIdTokenResult();
  return tokenResult.claims as {
    role?: UserRole;
    linkedStylistId?: string;
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    // onAuthStateChanged fires on sign-in / sign-out.
    // onIdTokenChanged additionally fires on token / claims refresh.
    // Together they keep both presence + role accurate.
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ status: "unauthenticated" });
        return;
      }
      const claims = await readClaims(user);
      if (!claims.role) {
        setState({ status: "unauthenticated" });
        return;
      }
      setState({
        status: "authenticated",
        user,
        role: claims.role,
        linkedStylistId: claims.linkedStylistId ?? null,
      });
    });

    const unsubToken = onIdTokenChanged(auth, async (user) => {
      if (!user) return;
      const claims = await readClaims(user);
      if (!claims.role) return;
      setState((prev) =>
        prev.status === "authenticated"
          ? {
              ...prev,
              user,
              role: claims.role!,
              linkedStylistId: claims.linkedStylistId ?? null,
            }
          : prev,
      );
    });

    return () => {
      unsubAuth();
      unsubToken();
    };
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}
