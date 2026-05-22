/**
 * esbuild deploy bundle for Cloud Functions — see docs/decisions.md D-015.
 *
 * Why this exists: functions/ imports @hsb/shared (pricing, availability,
 * firestore-helpers, types), but @hsb/shared is a PRIVATE workspace package —
 * it is NOT on the npm registry. `firebase deploy` ships only the functions/
 * folder + its package.json and runs `npm install` in the cloud, which would
 * 404 on "@hsb/shared". So @hsb/shared is HARD-REMOVED from package.json deps
 * and instead INLINED into lib/index.js by this bundle. Locally it resolves via
 * the workspace symlink (root node_modules/@hsb/shared -> packages/shared).
 *
 * @hsb/shared is read from packages/shared/DIST (its package.json exports point
 * there), so firebase.json predeploy builds packages/shared FIRST.
 *
 * Run after `tsc --noEmit` (typecheck) — see functions/package.json build script.
 */
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "lib/index.js",
  bundle: true,
  platform: "node",
  format: "esm", // functions/package.json has "type": "module"
  target: "node22", // Gen2 cloud runtime (D-010)
  sourcemap: true, // external .js.map; needs --enable-source-maps at runtime to
  // remap cloud stack traces — that activation is a Day 6 deploy follow-up (D-015).
  logLevel: "info",
  // Inline ONLY @hsb/shared. Everything below is provided by the cloud runtime
  // (firebase-*) or installed from package.json dependencies (zod) — keep external.
  external: [
    "firebase-admin",
    "firebase-admin/*",
    "firebase-functions",
    "firebase-functions/*",
    "zod",
  ],
});
