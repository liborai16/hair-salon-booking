import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { signIn, useAuth } from "../../lib/auth";

const inputCls = [
  "w-full mt-2 px-4 py-3 rounded-xl",
  "bg-white/[0.03] backdrop-blur-xl",
  "border border-white/10",
  "text-white placeholder-white/30",
  "transition-all duration-200",
  "focus:outline-none focus:border-[var(--color-accent)]/50 focus:bg-white/[0.06]",
  "focus:shadow-[0_0_0_3px_rgba(212,165,116,0.1)]",
].join(" ");

const labelCls = "block text-xs uppercase tracking-wider text-white/60";

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
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)] px-4 py-12">
      <div className="max-w-md w-full">
        <h1 className="font-display text-2xl md:text-3xl tracking-tight mb-6 text-white">
          Přihlášení do administrace
        </h1>
        <form onSubmit={submit} className="space-y-5">
          <label className="block">
            <span className={labelCls}>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              autoComplete="email"
              required
            />
          </label>
          <label className="block">
            <span className={labelCls}>Heslo</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/[0.05] border border-[var(--color-danger)]/30 rounded-xl p-4">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary btn-primary-hover"
          >
            {submitting ? "Přihlašuji…" : "Přihlásit"}
          </button>
        </form>
        <div className="mt-10 text-xs text-white/50 border-t border-white/10 pt-4">
          <strong className="text-white/80">Demo prostředí:</strong> viz README
          §5 pro 6 testovacích účtů (3 role × heslo{" "}
          <code className="bg-white/[0.05] px-1.5 py-0.5 rounded text-white/70 font-mono">
            Heslo123!
          </code>
          ).
        </div>
      </div>
    </div>
  );
}
