"use client";

import { useCallback, useEffect, useRef } from "react";

import { fetchModelBuffer } from "@/lib/model/loader";
import type { WorkerResponse } from "@/lib/model/types";
import { useSessionStore } from "@/store/session";

/**
 * Owns the inference worker: downloads the model (with progress), initialises
 * the ONNX session inside the worker, exposes a stable ref to post inference
 * requests through. Model status is published to the session store so the
 * header chip and the ModelGate render from one source.
 */
export function useModelLoader() {
  const workerRef = useRef<Worker | null>(null);
  const setModel = useSessionStore((s) => s.setModel);

  const init = useCallback(
    async (onMessage?: (msg: WorkerResponse) => void) => {
      if (workerRef.current) return;
      try {
        const worker = new Worker(
          new URL("../workers/inference.worker.ts", import.meta.url),
        );
        workerRef.current = worker;
        let fromCache = false;
        let ready = false;

        worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const msg = e.data;
          if (msg.type === "ready") {
            ready = true;
            setModel({ phase: "ready", backend: msg.backend, fromCache });
          } else if (msg.type === "error") {
            if (!ready) {
              // Init-time failure: release the worker so the ModelGate Retry
              // button can re-run init instead of hitting the ref guard above.
              // Transient inference errors after ready keep the live session.
              worker.terminate();
              workerRef.current = null;
            }
            setModel({ phase: "error", message: msg.message });
          }
          onMessage?.(msg);
        };

        const result = await fetchModelBuffer((p) => {
          if (p.phase === "downloading") {
            setModel({ phase: "downloading", received: p.received, total: p.total });
          } else if (p.phase === "compiling") {
            setModel({ phase: "compiling" });
          }
        });
        fromCache = result.fromCache;
        if (fromCache) setModel({ phase: "compiling" });
        worker.postMessage({ type: "init", buffer: result.buffer }, [result.buffer]);
      } catch (err) {
        // Model fetch failed: release the worker so Retry re-runs a full init.
        workerRef.current?.terminate();
        workerRef.current = null;
        setModel({
          phase: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [setModel],
  );

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return { init, workerRef };
}
