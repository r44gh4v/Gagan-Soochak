"use client";

import { create } from "zustand";

import {
  CONF_THRESHOLD,
  PROCESS_EVERY_N,
} from "@/lib/detection/constants";
import { DEFAULT_ROUTE_ID } from "@/lib/mock/routes";
import { defaultPatrolStart } from "@/lib/mock/time";

export type ModelStatus =
  | { phase: "idle" }
  | { phase: "downloading"; received: number; total: number }
  | { phase: "compiling" }
  | { phase: "ready"; backend: "webgpu" | "wasm"; fromCache: boolean }
  | { phase: "error"; message: string };

type PerfStats = {
  framesSeen: number;
  framesProcessed: number;
  detections: number;
  incidentsCreated: number;
  /** Repeat sightings folded into an existing incident. */
  mergedSightings: number;
  highAlerts: number;
  inferenceMsTotal: number;
  inferenceMsLast: number;
  inferenceSamples: number[]; // ring for p95
  sessionStartedAt: number | null;
};

type SessionState = {
  model: ModelStatus;
  perf: PerfStats;

  // run config (live-adjustable in the monitor)
  skipN: number;
  confThreshold: number;
  routeId: string;
  patrolStartIso: string;
  sourceLabel: string;

  setModel: (m: ModelStatus) => void;
  setSkipN: (n: number) => void;
  setConfThreshold: (c: number) => void;
  setRouteId: (id: string) => void;
  setPatrolStartIso: (iso: string) => void;
  setSourceLabel: (label: string) => void;
  recordFrame: (processed: boolean) => void;
  recordInference: (ms: number, detections: number) => void;
  recordIncident: () => void;
  recordMergedSighting: () => void;
  recordHighAlert: () => void;
  resetPerf: () => void;
};

const emptyPerf = (): PerfStats => ({
  framesSeen: 0,
  framesProcessed: 0,
  detections: 0,
  incidentsCreated: 0,
  mergedSightings: 0,
  highAlerts: 0,
  inferenceMsTotal: 0,
  inferenceMsLast: 0,
  inferenceSamples: [],
  sessionStartedAt: null,
});

export const useSessionStore = create<SessionState>()((set) => ({
  model: { phase: "idle" },
  perf: emptyPerf(),

  skipN: PROCESS_EVERY_N,
  confThreshold: CONF_THRESHOLD,
  routeId: DEFAULT_ROUTE_ID,
  patrolStartIso: defaultPatrolStart(),
  sourceLabel: "",

  setModel: (model) => set({ model }),
  setSkipN: (skipN) => set({ skipN }),
  setConfThreshold: (confThreshold) => set({ confThreshold }),
  setRouteId: (routeId) => set({ routeId }),
  setPatrolStartIso: (patrolStartIso) => set({ patrolStartIso }),
  setSourceLabel: (sourceLabel) => set({ sourceLabel }),

  recordFrame: (processed) =>
    set((s) => ({
      perf: {
        ...s.perf,
        framesSeen: s.perf.framesSeen + 1,
        framesProcessed: s.perf.framesProcessed + (processed ? 1 : 0),
        sessionStartedAt: s.perf.sessionStartedAt ?? Date.now(),
      },
    })),

  recordInference: (ms, detections) =>
    set((s) => {
      const samples = [...s.perf.inferenceSamples, ms];
      if (samples.length > 200) samples.shift();
      return {
        perf: {
          ...s.perf,
          detections: s.perf.detections + detections,
          inferenceMsTotal: s.perf.inferenceMsTotal + ms,
          inferenceMsLast: ms,
          inferenceSamples: samples,
        },
      };
    }),

  recordIncident: () =>
    set((s) => ({
      perf: { ...s.perf, incidentsCreated: s.perf.incidentsCreated + 1 },
    })),

  recordMergedSighting: () =>
    set((s) => ({
      perf: { ...s.perf, mergedSightings: s.perf.mergedSightings + 1 },
    })),

  recordHighAlert: () =>
    set((s) => ({ perf: { ...s.perf, highAlerts: s.perf.highAlerts + 1 } })),

  resetPerf: () => set({ perf: emptyPerf() }),
}));

export function avgInferenceMs(perf: PerfStats): number {
  const n = perf.inferenceSamples.length;
  return n ? perf.inferenceMsTotal / Math.max(1, perf.framesProcessed) : 0;
}

export function p95InferenceMs(perf: PerfStats): number {
  const sorted = [...perf.inferenceSamples].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

export function effectiveFps(perf: PerfStats): number {
  if (!perf.sessionStartedAt || !perf.framesSeen) return 0;
  const elapsed = (Date.now() - perf.sessionStartedAt) / 1000;
  return elapsed > 0 ? perf.framesSeen / elapsed : 0;
}
