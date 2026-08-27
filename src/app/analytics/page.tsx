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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CLASS_LABELS, CLASSES, type SeverityLevel } from "@/lib/detection/constants";
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
  { cls: "drain_overflow", map50: 0.72, note: "~80 post-filter, ~16 val instances" },
];

const AXIS = { fontSize: 11, fill: "#71717a" };

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
      needsAction: by("open") + by("assigned") + by("in_progress"),
      p1: all.filter(
        (i) => i.priority === "P1" && !["closed", "rejected"].includes(i.status),
      ).length,
      resolved: by("resolved"),
      closed: by("closed"),
      rejected: by("rejected"),
      avgSeverity: all.length
        ? all.reduce((a, i) => a + i.severityScore, 0) / all.length
        : 0,
    };
  }, [all]);

  const byClass = CLASSES.map((c) => ({
    name: CLASS_LABELS[c].replace(" Road", ""),
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
      <div className="p-4">
        <EmptyState
          icon={BarChart3}
          title="No session data yet"
          description="Analytics fill in as detections run - open the Monitor and play a clip."
          actionLabel="Open Monitor"
          actionHref="/monitor"
        />
      </div>
    );
  }

  const tile = (label: string, value: string, tone?: string) => (
    <Card key={label} className="gap-0 py-3">
      <CardContent className="px-4">
        <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${tone ?? ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );

  const chart = (title: string, node: React.ReactNode) => (
    <Card className="gap-0 py-3">
      <CardHeader className="px-4 pb-1">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-44 px-2">
        <ResponsiveContainer>{node as React.ReactElement}</ResponsiveContainer>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tile("Needs action", String(kpis.needsAction))}
        {tile("Open P1", String(kpis.p1), kpis.p1 ? "text-[#b91c1c]" : "")}
        {tile("Resolved", String(kpis.resolved))}
        {tile("Closed", String(kpis.closed))}
        {tile("Rejected (FP)", String(kpis.rejected))}
        {tile("Avg severity", kpis.avgSeverity.toFixed(2))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {chart(
          "By hazard class",
          <BarChart data={byClass} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid stroke="#e4e4e7" vertical={false} />
            <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <RTooltip cursor={{ fill: "#f4f4f5" }} />
            <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} />
          </BarChart>,
        )}

        {chart(
          "By severity",
          <PieChart>
            <Pie
              data={bySeverity}
              dataKey="value"
              nameKey="name"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
              label={({ name, value }) => (value ? `${name} ${value}` : "")}
              labelLine={false}
              isAnimationActive={false}
            >
              {bySeverity.map((s) => (
                <Cell key={s.name} fill={SEVERITY_FILL[s.name as SeverityLevel]} />
              ))}
            </Pie>
            <RTooltip />
          </PieChart>,
        )}

        {chart(
          "By zone",
          <BarChart
            data={byZone}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
          >
            <CartesianGrid stroke="#e4e4e7" horizontal={false} />
            <XAxis type="number" tick={AXIS} axisLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ ...AXIS, fontSize: 10 }}
              width={96}
              tickLine={false}
              axisLine={false}
            />
            <RTooltip cursor={{ fill: "#f4f4f5" }} />
            <Bar dataKey="count" fill="#2563eb" radius={[0, 3, 3, 0]} />
          </BarChart>,
        )}

        {chart(
          "Workflow status",
          <BarChart data={byStatus} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid stroke="#e4e4e7" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ ...AXIS, fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <RTooltip cursor={{ fill: "#f4f4f5" }} />
            <Bar dataKey="count" fill="#7c3aed" radius={[3, 3, 0, 0]} />
          </BarChart>,
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="gap-0 py-3">
          <CardHeader className="flex-row items-center gap-2 px-4 pb-2">
            <CardTitle className="text-sm">Model performance</CardTitle>
            <Badge variant="secondary" className="font-normal">
              this session
            </Badge>
          </CardHeader>
          <CardContent className="px-4">
            <dl className="grid grid-cols-2 gap-x-6">
              {(
                [
                  ["Backend", model.phase === "ready" ? (model.backend === "webgpu" ? "WebGPU" : "WASM") : "-"],
                  ["Avg inference", avgMs ? `${avgMs.toFixed(1)} ms` : "-"],
                  ["p95 inference", p95InferenceMs(perf) ? `${p95InferenceMs(perf).toFixed(1)} ms` : "-"],
                  ["Sampling rate", effectiveFps(perf) ? `${effectiveFps(perf).toFixed(1)} Hz` : "-"],
                  ["Frames seen", String(perf.framesSeen)],
                  ["Frames processed", `${perf.framesProcessed} (every ${skipN})`],
                  ["Raw detections", String(perf.detections)],
                  ["Incidents created", String(perf.incidentsCreated)],
                  ["Model file", "best.onnx · 11.7 MB"],
                  ["Input", "640×640 letterboxed"],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-2 border-b py-1.5 text-sm last:border-0"
                >
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Reference: the Python edge pipeline measured 7.7 FPS unskipped /
              ~14-15 FPS at N=2 on a laptop CPU (Technical Build Notes §4).
            </p>
          </CardContent>
        </Card>

        <Card className="gap-0 py-3">
          <CardHeader className="flex-row items-center gap-2 px-4 pb-2">
            <CardTitle className="text-sm">Validation metrics</CardTitle>
            <Badge variant="outline" className="font-normal">
              training metric
            </Badge>
          </CardHeader>
          <CardContent className="px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8">Class</TableHead>
                  <TableHead className="h-8">mAP50</TableHead>
                  <TableHead className="h-8">Training data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {VAL_MAP50.map((r) => (
                  <TableRow key={r.cls}>
                    <TableCell className="font-mono text-xs">{r.cls}</TableCell>
                    <TableCell className="tabular-nums">{r.map50.toFixed(3)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.note}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              YOLOv8n, 100 epochs, 20% held-out split. All classes clear the
              proposal&apos;s 0.70 target. drain_overflow is measured over ~16
              validation instances - treat with wide error bars. Distinct from
              the live session numbers on the left.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
