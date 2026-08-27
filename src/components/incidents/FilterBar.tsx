"use client";

import { Search } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLASS_LABELS, CLASSES } from "@/lib/detection/constants";
import { STATUS_LABELS } from "@/lib/workflow/lifecycle";
import type { IncidentStatus } from "@/lib/workflow/types";

export type QueueFilters = {
  cls: string; // "all" | HazardClass
  sev: string; // "all" | SeverityLevel
  status: string; // "all" | "active" | IncidentStatus
  pri: string; // "all" | Priority
  zone: string; // "all" | zone name
  esc: boolean;
  q: string;
};

export const DEFAULT_FILTERS: QueueFilters = {
  cls: "all",
  sev: "all",
  status: "active",
  pri: "all",
  zone: "all",
  esc: false,
  q: "",
};

export function FilterBar({
  filters,
  zones,
  count,
  onChange,
}: {
  filters: QueueFilters;
  zones: string[];
  count: number;
  onChange: (next: Partial<QueueFilters>) => void;
}) {
  const sel = (
    value: string,
    onValue: (v: string) => void,
    placeholder: string,
    items: [string, string][],
  ) => (
    <Select value={value} onValueChange={onValue}>
      <SelectTrigger size="sm" className="w-fit min-w-28 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map(([v, label]) => (
          <SelectItem key={v} value={v} className="text-xs">
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="sticky top-14 z-30 -mx-4 -mt-4 border-b bg-background px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {sel(filters.cls, (v) => onChange({ cls: v }), "Class", [
          ["all", "All classes"],
          ...CLASSES.map((c) => [c, CLASS_LABELS[c]] as [string, string]),
        ])}
        {sel(filters.sev, (v) => onChange({ sev: v }), "Severity", [
          ["all", "All severities"],
          ["High", "High"],
          ["Medium", "Medium"],
          ["Low", "Low"],
        ])}
        {sel(filters.status, (v) => onChange({ status: v }), "Status", [
          ["active", "Active (needs action)"],
          ["all", "All statuses"],
          ...(Object.keys(STATUS_LABELS) as IncidentStatus[]).map(
            (s) => [s, STATUS_LABELS[s]] as [string, string],
          ),
        ])}
        {sel(filters.pri, (v) => onChange({ pri: v }), "Priority", [
          ["all", "All priorities"],
          ["P1", "P1"],
          ["P2", "P2"],
          ["P3", "P3"],
        ])}
        {sel(filters.zone, (v) => onChange({ zone: v }), "Zone", [
          ["all", "All zones"],
          ...zones.map((z) => [z, z] as [string, string]),
        ])}

        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox
            checked={filters.esc}
            onCheckedChange={(v) => onChange({ esc: v === true })}
          />
          Escalated only
        </Label>

        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search ID or landmark"
            className="h-8 w-56 pl-7 text-xs"
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {count} incident{count === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
