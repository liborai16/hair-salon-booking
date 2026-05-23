/**
 * Firebase client SDK initialization + emulator auto-switch.
 *
 * Production config is hardcoded — Firebase Web config is PUBLIC per
 * Firebase docs (security is enforced via Firestore Rules + Auth, not
 * API-key secrecy; bundled JS exposes it regardless of source pattern).
 * Evaluator cloning this repo for their own deploy registers their own
 * Web App (Firebase Console → Project settings → Your apps → Add app →
 * Web) and replaces the `initializeApp` values below. See README §4.
 *
 * In `import.meta.env.DEV` mode (Vite dev server) the connect*Emulator()
 * calls below override the production endpoints at runtime, so the same
 * config object works for local + production builds.
 *
 * Project ID `hair-salon-booking-cs-69a08` matches `.firebaserc`.
 */
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const app = initializeApp({
  apiKey: "AIzaSyDQhEeQU6p7HHVNLX3ht_F5LohaPY3ACew",
  authDomain: "hair-salon-booking-cs-69a08.firebaseapp.com",
  projectId: "hair-salon-booking-cs-69a08",
  storageBucket: "hair-salon-booking-cs-69a08.firebasestorage.app",
  messagingSenderId: "832705910764",
  appId: "1:832705910764:web:e30fa329b0ab3ab21612c9",
});

export const auth = getAuth(app);
export const db = getFirestore(app);
// europe-west3 matches D-010 + Cloud Functions setGlobalOptions
export const functions = getFunctions(app, "europe-west3");

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
  connectFunctionsEmulator(functions, "localhost", 5001);
}
