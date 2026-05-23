import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { BookingFlow } from "./pages/BookingFlow";
import { CancelPage } from "./pages/CancelPage";
import { AdminApp } from "./pages/admin/AdminApp";
// Side-effect import — initializes Firebase + connects emulators in dev mode.
import "./lib/firebase";

/**
 * Top-level router. Routes:
 *   /            → Landing (public marketing)
 *   /book        → BookingFlow (public 4-step booking)
 *   /r/:token    → CancelPage (magic-link self-cancel)
 *   /admin/*     → Admin (login + dashboard + management)
 *
 * All routes wrapped in shared Layout via Outlet pattern.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/book" element={<BookingFlow />} />
          <Route path="/r/:token" element={<CancelPage />} />
          <Route path="/admin/*" element={<AdminApp />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
