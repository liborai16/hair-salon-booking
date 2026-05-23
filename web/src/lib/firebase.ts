/**
 * Firebase client SDK initialization + emulator auto-switch.
 *
 * In `import.meta.env.DEV` mode (Vite dev server), connects Auth /
 * Firestore / Functions to local emulators (ports per `firebase.json`).
 * Production reads config from env vars (`VITE_FIREBASE_*`) at build time.
 *
 * Project ID `hair-salon-booking-cs-69a08` matches `.firebaserc` so admin
 * SDK + client SDK address the same emulator project.
 */
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const app = initializeApp({
  projectId: "hair-salon-booking-cs-69a08",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "demo-emulator-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
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
