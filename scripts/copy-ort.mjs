// Copies onnxruntime-web's runtime binaries into public/ort/.
// Next's bundler does not emit these; without this step the deployed app
// 404s on the .wasm/.mjs loader files at inference time.
//
// Only the two variants the app can actually bind are copied:
//   jsep  -> WebGPU execution provider (preferred path)
//   plain -> threaded WASM fallback
// The asyncify and jspi builds are for async-execution modes this app does
// not use, and skipping them keeps ~42 MB out of every deployment.
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const src = "node_modules/onnxruntime-web/dist";
const dst = "public/ort";
const KEEP = [
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
];

await mkdir(dst, { recursive: true });
const available = new Set(await readdir(src));
const missing = KEEP.filter((f) => !available.has(f));
if (missing.length) {
  throw new Error(
    `onnxruntime-web is missing expected runtime files: ${missing.join(", ")}. ` +
      `Check the installed version before deploying.`,
  );
}
await Promise.all(KEEP.map((f) => copyFile(join(src, f), join(dst, f))));
console.log(`copied ${KEEP.length} ORT runtime files -> ${dst}`);
