/// <reference lib="webworker" />
import * as ort from "onnxruntime-web";

import { INPUT_SIZE } from "@/lib/detection/constants";
import { decode } from "@/lib/model/postprocess";
import { preprocess } from "@/lib/model/preprocess";
import type { WorkerRequest, WorkerResponse } from "@/lib/model/types";

// Next's bundler does not serve ORT's runtime from node_modules - the files
// are copied to /public/ort by scripts/copy-ort.mjs.
ort.env.wasm.wasmPaths = "/ort/";

let session: ort.InferenceSession | null = null;
let backend: "webgpu" | "wasm" = "wasm";

const post = (msg: WorkerResponse) => self.postMessage(msg);

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      session = await createSession(msg.buffer);
      // Warm-up on zeros so the first real frame doesn't stall the demo.
      const dummy = new ort.Tensor(
        "float32",
        new Float32Array(3 * INPUT_SIZE * INPUT_SIZE),
        [1, 3, INPUT_SIZE, INPUT_SIZE],
      );
      await session.run({ images: dummy });
      post({ type: "ready", backend });
      return;
    }

    if (msg.type === "infer") {
      if (!session) throw new Error("inference before init");
      const { bitmap } = msg;
      const t0 = performance.now();
      const { data, meta } = preprocess(bitmap);
      bitmap.close(); // MUST close - leaked bitmaps kill the tab mid-demo

      const input = new ort.Tensor("float32", data, [1, 3, INPUT_SIZE, INPUT_SIZE]);
      const out = await session.run({ images: input });
      const detections = decode(out.output0.data as Float32Array, meta, msg.conf);

      post({
        type: "result",
        id: msg.id,
        detections,
        inferenceMs: performance.now() - t0,
        srcW: meta.srcW,
        srcH: meta.srcH,
      });
    }
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};

async function createSession(buffer: ArrayBuffer): Promise<ort.InferenceSession> {
  const opts: ort.InferenceSession.SessionOptions = {
    graphOptimizationLevel: "all",
  };
  // WebGPU when available, threaded WASM otherwise (COOP/COEP headers are set,
  // so SharedArrayBuffer multithreading is available as the fallback).
  try {
    const s = await ort.InferenceSession.create(buffer, {
      ...opts,
      executionProviders: ["webgpu"],
    });
    backend = "webgpu";
    return s;
  } catch {
    const s = await ort.InferenceSession.create(buffer, {
      ...opts,
      executionProviders: ["wasm"],
    });
    backend = "wasm";
    return s;
  }
}
