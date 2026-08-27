"use client";

import { BarChart3 } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/common/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CLASS_LABELS,
  CLASSES,
  type SeverityLevel,
} from "@/lib/detection/constants";
import { STATUS_LABELS } from "@/lib/workflow/lifecycle";
import type { IncidentStatus } from "@/lib/workflow/types";
import { useIncidentStore } from "@/store/incidents";
import { effectiveFps, p95InferenceMs, useSessionStore } from "@/store/session";

const SEVERITY_FILL: Record<SeverityLevel, string> = {
  High: "#dc2626",
  Medium: "#d97706",
  Low: "#059669",
};

const STATUSES: IncidentStatus[] = [
  "open",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
  "rejected",
];

/** Trained-model validation metrics - static, from Technical Build Notes §3. */
const VAL_MAP50 = [
  { cls: "pothole", map50: 0.893, note: "608 source images" },
  { cls: "waterlogged_road", map50: 0.743, note: "1,499 source images" },
  { cls: "drain_overflow", map50: 0.72, note: "~80 images post-filter, ~16 val instances" },
];

export default function AnalyticsPage() {
  const incidents = useIncidentStore((s) => s.incidents);
  const order = useIncidentStore((s) => s.order);
  const perf = useSessionStore((s) => s.perf);
  const model = useSessionStore((s) => s.model);
  const skipN = useSessionStore((s) => s.skipN);

  const all = useMemo(
    () => order.map((id) => incidents[id]).filter(Boolean),
    [order, incidents],
  );

  const kpis = useMemo(() => {
    const by = (s: IncidentStatus) => all.filter((i) => i.status === s).length;
    return {
      open: by("open") + by("assigned") + by("in_progress"),
      resolved: by("resolved"),
      closed: by("closed"),
      rejected: by("rejected"),
      avgSeverity: all.length
        ? all.reduce((a, i) => a + i.severityScore, 0) / all.length
        : 0,
    };
  }, [all]);

  const byClass = CLASSES.map((c) => ({
    name: CLASS_LABELS[c],
    count: all.filter((i) => i.hazardClass === c).length,
  }));

  const bySeverity = (["High", "Medium", "Low"] as SeverityLevel[]).map((s) => ({
    name: s,
    value: all.filter((i) => i.severityLevel === s).length,
  }));

  const byZone = useMemo(() => {
    const zones = new Map<string, number>();
    for (const i of all) zones.set(i.location.zone, (zones.get(i.location.zone) ?? 0) + 1);
    return [...zones.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [all]);

  const byStatus = STATUSES.map((s) => ({
    name: STATUS_LABELS[s],
    count: all.filter((i) => i.status === s).length,
  }));

  const avgMs =
    perf.framesProcessed > 0 ? perf.inferenceMsTotal / perf.framesProcessed : 0;

  if (all.length === 0 && perf.framesProcessed === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No session data yet"
        description="Analytics fill in as detections run - open the Monitor and play a clip."
        actionLabel="Open Monitor"
        actionHref="/monitor"
      />
    );
  }

  const tile = (label: string, value: string, tone?: string) => (
    <Card key={label} className="py-3">
      <CardContent className="px-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tile("Needs action", String(kpis.open), kpis.open ? "text-[#b91c1c]" : "")}
        {tile("Resolved", String(kpis.resolved))}
        {tile("Closed", String(kpis.closed))}
        {tile("Rejected (FP)", String(kpis.rejected))}
        {tile("Avg severity", kpis.avgSeverity.toFixed(2))}
        {tile("Detections", String(perf.detections))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Incidents by class</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer>
              <BarChart data={byClass} margin={{ left: -20 }}>
                <CartesianGrid stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} allowDecimals={false} />
                <RTooltip cursor={{ fill: "#f4f4f5" }} />
                <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By severity</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={bySeverity}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  label={({ name, value }) => (value ? `${name} ${value}` : "")}
                  labelLine={false}
                >
                  {bySeverity.map((s) => (
                    <Cell key={s.name} fill={SEVERITY_FILL[s.name as SeverityLevel]} />
                  ))}
                </Pie>
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By zone</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer>
              <BarChart data={byZone} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid stroke="#e4e4e7" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={110}
                  tickLine={false}
                />
                <RTooltip cursor={{ fill: "#f4f4f5" }} />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status funnel</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer>
              <BarChart data={byStatus} margin={{ left: -20 }}>
                <CartesianGrid stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} allowDecimals={false} />
                <RTooltip cursor={{ fill: "#f4f4f5" }} />
                <Bar dataKey="count" fill="#7c3aed" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Model performance - measured this session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {(
                [
                  ["Backend", model.phase === "ready" ? (model.backend === "webgpu" ? "WebGPU" : "WASM (threaded)") : "-"],
                  ["Avg inference", avgMs ? `${avgMs.toFixed(1)} ms` : "-"],
                  ["p95 inference", p95InferenceMs(perf) ? `${p95InferenceMs(perf).toFixed(1)} ms` : "-"],
                  ["Effective FPS", effectiveFps(perf) ? effectiveFps(perf).toFixed(1) : "-"],
                  ["Frames seen", String(perf.framesSeen)],
                  ["Frames processed", `${perf.framesProcessed} (every ${skipN})`],
                  ["Raw detections", String(perf.detections)],
                  ["Incidents created", String(perf.incidentsCreated)],
                  ["Model file", "best.onnx · 11.7 MB fp32"],
                  ["Input", "640×640 letterboxed (of 640×720 stretch)"],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b py-1 last:border-0">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
              Reference: the Python edge pipeline measured 7.7 FPS unskipped /
              ~14-15 FPS at N=2 on a laptop CPU (Technical Build Notes §4).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              Validation metrics
              <span className="rounded border bg-muted px-1 py-px text-[10px] font-medium text-muted-foreground">
                TRAINING METRIC
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Class</th>
                  <th className="py-1 font-medium">mAP50</th>
                  <th className="py-1 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {VAL_MAP50.map((r) => (
                  <tr key={r.cls} className="border-b last:border-0">
                    <td className="py-1.5 font-mono text-xs">{r.cls}</td>
                    <td className="py-1.5 tabular-nums">{r.map50.toFixed(3)}</td>
                    <td className="py-1.5 text-xs text-muted-foreground">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
              YOLOv8n, 100 epochs, 20% held-out split. All classes clear the
              proposal&apos;s 0.70 target. drain_overflow&apos;s figure is over ~16
              validation instances - treat it with wide error bars. These are
              training-time numbers, distinct from the live session
              measurements on the left.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
