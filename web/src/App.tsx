import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { BookingFlow } from "./pages/BookingFlow";
import { CancelPage } from "./pages/CancelPage";
import { AdminApp } from "./pages/admin/AdminApp";
import { AuthProvider } from "./lib/auth";
// Side-effect import — initializes Firebase + connects emulators in dev mode.
import "./lib/firebase";

/**
 * Top-level router. Routes:
 *   /            → Landing (public)
 *   /book        → BookingFlow (public 4-step)
 *   /r/:token    → CancelPage (magic-link self-cancel)
 *   /admin/*     → AdminApp (own AdminLayout — separate from public Layout)
 *
 * AuthProvider wraps the whole tree so both public and admin routes can
 * read auth state if needed (public flow doesn't, but keeps shape simple).
 */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/book" element={<BookingFlow />} />
            <Route path="/r/:token" element={<CancelPage />} />
          </Route>
          <Route path="/admin/*" element={<AdminApp />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
