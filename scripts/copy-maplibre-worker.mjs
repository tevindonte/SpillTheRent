import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * MapLibre v6 loads a module worker that imports ./maplibre-gl-shared.mjs by
 * relative path. Next/webpack often break that resolution, which surfaces as:
 * "Failed to load module script ... MIME type of text/html".
 * Serve both files from /public so the relative import works.
 */
const require = createRequire(import.meta.url);
const dist = path.join(
  path.dirname(require.resolve("maplibre-gl/package.json")),
  "dist"
);
const dest = path.join(process.cwd(), "public", "maplibre");

mkdirSync(dest, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(path.join(dist, file), path.join(dest, file));
  console.log(`copied ${file} → public/maplibre/`);
}
