/**
 * Firebase bootstrap — global function options + Admin SDK init.
 *
 * Every handler imports this module before it defines its trigger
 * (onCall/...). ES-module evaluation runs a module's dependencies before its
 * own body, so importing this file GUARANTEES setGlobalOptions() has executed
 * before any function is defined — which is required for the region /
 * maxInstances defaults to actually apply.
 *
 * Why not keep setGlobalOptions in index.ts: index.ts deploys functions via
 * `export { createBooking } from "./handlers/..."`. That re-export is a
 * dependency, so the handler module — and its onCall() call — is evaluated
 * BEFORE index.ts's own top-level statements run. setGlobalOptions() placed in
 * index.ts would therefore fire too late and the region would silently fall
 * back to the us-central1 default. Putting it here, upstream of every handler,
 * removes that ordering hazard.
 *
 * The getApps() guard makes admin init idempotent across warm instance reuse.
 */

import { setGlobalOptions } from "firebase-functions/v2";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

setGlobalOptions({
  region: "europe-west3",
  maxInstances: 10,
});

if (getApps().length === 0) {
  initializeApp();
}

/** Shared Firestore handle (Admin SDK) for all Cloud Function handlers. */
export const db = getFirestore();
