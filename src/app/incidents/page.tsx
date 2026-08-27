"use client";

import { Inbox, LayoutGrid, List, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDelete } from "@/components/common/ConfirmDelete";
import { EmptyState } from "@/components/common/EmptyState";
import {
  DEFAULT_FILTERS,
  FilterBar,
  type QueueFilters,
} from "@/components/incidents/FilterBar";
import { ExportMenu } from "@/components/incidents/ExportMenu";
import { IncidentCard } from "@/components/incidents/IncidentCard";
import { IncidentTable } from "@/components/incidents/IncidentTable";
import { Button } from "@/components/ui/button";
import { SEVERITY_ORDER } from "@/lib/detection/constants";
import { ACTIVE_STATUSES, canTransition } from "@/lib/workflow/lifecycle";
import type { Incident } from "@/lib/workflow/types";
import { suggestedOwnerFor, useIncidentStore } from "@/store/incidents";

const PRIORITY_ORDER = { P1: 0, P2: 1, P3: 2 } as const;

function filtersFromParams(params: URLSearchParams): QueueFilters {
  return {
    cls: params.get("cls") ?? DEFAULT_FILTERS.cls,
    sev: params.get("sev") ?? DEFAULT_FILTERS.sev,
    status: params.get("status") ?? DEFAULT_FILTERS.status,
    pri: params.get("pri") ?? DEFAULT_FILTERS.pri,
    zone: params.get("zone") ?? DEFAULT_FILTERS.zone,
    esc: params.get("esc") === "1",
    q: params.get("q") ?? "",
  };
}

function QueueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const incidents = useIncidentStore((s) => s.incidents);
  const order = useIncidentStore((s) => s.order);
  const assignOwner = useIncidentStore((s) => s.assignOwner);
  const bulkTransition = useIncidentStore((s) => s.bulkTransition);
  const deleteIncidents = useIncidentStore((s) => s.deleteIncidents);
  const clearAll = useIncidentStore((s) => s.clearAll);

  const filters = filtersFromParams(searchParams);
  const view = searchParams.get("view") === "cards" ? "cards" : "table";
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filter state lives in the URL: shareable, survives back-navigation.
  const updateParams = (next: Partial<QueueFilters> | { view: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      const def =
        k in DEFAULT_FILTERS
          ? DEFAULT_FILTERS[k as keyof QueueFilters]
          : "table";
      if (v === def || v === "" || v === false) params.delete(k);
      else params.set(k, v === true ? "1" : String(v));
    }
    router.replace(`/incidents?${params.toString()}`, { scroll: false });
  };

  const all = useMemo(
    () => order.map((id) => incidents[id]).filter(Boolean),
    [order, incidents],
  );

  const zones = useMemo(
    () => [...new Set(all.map((i) => i.location.zone))].sort(),
    [all],
  );

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return all
      .filter((i) => {
        if (filters.cls !== "all" && i.hazardClass !== filters.cls) return false;
        if (filters.sev !== "all" && i.severityLevel !== filters.sev) return false;
        if (filters.status === "active") {
          if (!ACTIVE_STATUSES.includes(i.status)) return false;
        } else if (filters.status !== "all" && i.status !== filters.status) {
          return false;
        }
        if (filters.pri !== "all" && i.priority !== filters.pri) return false;
        if (filters.zone !== "all" && i.location.zone !== filters.zone) return false;
        if (filters.esc && !i.escalated) return false;
        if (
          q &&
          !i.id.toLowerCase().includes(q) &&
          !i.location.landmark.toLowerCase().includes(q)
        )
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          SEVERITY_ORDER[b.severityLevel] - SEVERITY_ORDER[a.severityLevel] ||
          +new Date(b.detectedAt) - +new Date(a.detectedAt),
      );
  }, [all, filters]);

  // Bulk actions and the count operate only on rows the operator can
  // currently SEE — narrowing a filter after select-all must not let a bulk
  // reject silently push invisible incidents into a terminal state.
  const visibleSelected = useMemo(() => {
    if (selected.size === 0) return selected;
    const visible = new Set(filtered.map((i) => i.id));
    return new Set([...selected].filter((id) => visible.has(id)));
  }, [selected, filtered]);

  const bulkAssign = () => {
    let n = 0;
    for (const id of visibleSelected) {
      const inc = incidents[id];
      if (inc?.status === "open") {
        assignOwner(id, suggestedOwnerFor(inc));
        n++;
      }
    }
    toast(`${n} incident${n === 1 ? "" : "s"} assigned to suggested departments`);
    setSelected(new Set());
  };

  const bulkReject = () => {
    // Count only incidents the lifecycle actually allows into `rejected`, so
    // the toast never over-reports (resolved/closed rows are skipped).
    const ids = [...visibleSelected].filter((id) => {
      const inc = incidents[id];
      return inc && canTransition(inc.status, "rejected");
    });
    bulkTransition(ids, "rejected", "bulk-rejected by operator");
    toast(`${ids.length} incident${ids.length === 1 ? "" : "s"} rejected`);
    setSelected(new Set());
  };

  const deleteSelected = () => {
    const ids = [...visibleSelected];
    void deleteIncidents(ids).then(() => {
      setSelected(new Set());
      toast(`${ids.length} incident${ids.length === 1 ? "" : "s"} deleted`);
    });
  };

  if (all.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={Inbox}
          title="No incidents yet"
          description="Run a clip on the Monitor to start detecting hazards - every detection lands here as an incident with evidence."
          actionLabel="Open Monitor"
          actionHref="/monitor"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <FilterBar
        filters={filters}
        zones={zones}
        count={filtered.length}
        onChange={updateParams}
      />

      <div className="flex flex-wrap items-center gap-2">
        {visibleSelected.size > 0 ? (
          <>
            <span className="text-xs text-muted-foreground">
              {visibleSelected.size} selected
            </span>
            <Button size="sm" variant="outline" onClick={bulkAssign}>
              Assign suggested
            </Button>
            <Button size="sm" variant="outline" onClick={bulkReject}>
              Reject
            </Button>
            <ConfirmDelete
              trigger={
                <Button size="sm" variant="outline" className="text-destructive">
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              }
              title={`Delete ${visibleSelected.size} incident${visibleSelected.size === 1 ? "" : "s"}?`}
              description="Removes the records and their stored evidence images. Rejecting is usually the right action for a false positive - it keeps the incident on record."
              confirmLabel="Delete"
              onConfirm={deleteSelected}
            />
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            Sorted by priority, then severity, then newest
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => updateParams({ view: view === "table" ? "cards" : "table" })}
          >
            {view === "table" ? (
              <LayoutGrid className="size-3.5" />
            ) : (
              <List className="size-3.5" />
            )}
            {view === "table" ? "Cards" : "Table"}
          </Button>
          <ExportMenu incidents={filtered} />
          <ConfirmDelete
            trigger={
              <Button size="sm" variant="outline" className="text-destructive">
                <Trash2 className="size-3.5" />
                Delete all
              </Button>
            }
            title={`Delete all ${all.length} incidents?`}
            description="Clears every incident and its stored evidence from this browser. Export first if you need the records."
            confirmLabel="Delete all"
            onConfirm={() => {
              void clearAll().then(() => {
                setSelected(new Set());
                toast("All incidents deleted");
              });
            }}
          />
        </div>
      </div>

      {view === "table" ? (
        <IncidentTable
          incidents={filtered}
          selected={visibleSelected}
          onSelectedChange={setSelected}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((inc: Incident) => (
            <IncidentCard key={inc.id} incident={inc} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense>
      <QueueContent />
    </Suspense>
  );
}
