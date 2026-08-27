// Copies onnxruntime-web's runtime binaries into public/ort/.
// Next's bundler does not emit these; without this step the deployed app
// 404s on the .wasm/.mjs loader files at inference time.
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const src = "node_modules/onnxruntime-web/dist";
const dst = "public/ort";

await mkdir(dst, { recursive: true });
const files = (await readdir(src)).filter(
  (f) => f.endsWith(".wasm") || (f.startsWith("ort-wasm") && f.endsWith(".mjs")),
);
await Promise.all(files.map((f) => copyFile(join(src, f), join(dst, f))));
console.log(`copied ${files.length} ORT runtime files -> ${dst}`);
