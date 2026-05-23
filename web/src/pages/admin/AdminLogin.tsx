import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { signIn, useAuth } from "../../lib/auth";

export function AdminLogin() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated (e.g. user revisits /admin/login).
  // Honors `from` state set by RequireAuth so post-login returns user to
  // the original protected route.
  useEffect(() => {
    if (auth.status === "authenticated") {
      const from =
        (location.state as { from?: { pathname: string } } | null)?.from
          ?.pathname ?? "/admin/dashboard";
      navigate(from, { replace: true });
    }
  }, [auth, navigate, location]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      // Auth state change triggers redirect via useEffect above.
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message ?? "Přihlášení selhalo.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <h1 className="text-2xl font-semibold mb-6">
        Přihlášení do administrace
      </h1>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-stone-700">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-stone-300 rounded-md px-3 py-2"
            autoComplete="email"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-stone-700">Heslo</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-stone-300 rounded-md px-3 py-2"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800 transition disabled:opacity-40"
        >
          {submitting ? "Přihlašuji…" : "Přihlásit"}
        </button>
      </form>
      <div className="mt-8 text-xs text-stone-500 border-t border-stone-200 pt-4">
        <strong className="text-stone-700">Demo prostředí:</strong> viz README
        §5 pro 6 testovacích účtů (3 role × heslo{" "}
        <code className="bg-stone-100 px-1">Heslo123!</code>).
      </div>
    </div>
  );
}
