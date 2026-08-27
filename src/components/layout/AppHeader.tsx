"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { ModelStatusChip } from "@/components/layout/ModelStatusChip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACTIVE_STATUSES } from "@/lib/workflow/lifecycle";
import { useIncidentStore } from "@/store/incidents";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/monitor", label: "Monitor" },
  { href: "/incidents", label: "Queue" },
  { href: "/analytics", label: "Analytics" },
  { href: "/about", label: "About" },
];

export function AppHeader() {
  const pathname = usePathname();
  const incidents = useIncidentStore((s) => s.incidents);
  const clearAll = useIncidentStore((s) => s.clearAll);

  const all = Object.values(incidents);
  const open = all.filter((i) => ACTIVE_STATUSES.includes(i.status)).length;
  const p1 = all.filter(
    (i) => i.priority === "P1" && ACTIVE_STATUSES.includes(i.status),
  ).length;

  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="flex h-14 items-center gap-6 px-6">
        <Link href="/monitor" className="shrink-0">
          <div className="text-sm font-semibold leading-tight">Gagan Soochak</div>
          <div className="text-[11px] leading-tight text-muted-foreground">
            Electronic City · Monsoon &amp; Roads
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm",
                  active
                    ? "font-medium text-foreground underline decoration-primary decoration-2 underline-offset-8"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {all.length > 0 && (
            <Link
              href="/incidents"
              className="text-xs tabular-nums text-muted-foreground hover:text-foreground"
            >
              {open} active{p1 > 0 && <span className="text-[#b91c1c]"> · {p1} P1</span>}
            </Link>
          )}
          <ModelStatusChip />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/incidents">Export incidents…</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void (async () => {
                    const { buildSeedIncidents } = await import("@/lib/mock/seed");
                    const { defaultPatrolStart } = await import("@/lib/mock/time");
                    const seeded = await buildSeedIncidents(defaultPatrolStart());
                    useIncidentStore.getState().loadIncidents(seeded);
                    toast(`Loaded ${seeded.length} seeded demo incidents`, {
                      description: "Badged as SEED DATA - separate from real detections",
                    });
                  })();
                }}
              >
                Load demo data (seeded)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  void clearAll().then(() => toast("Demo data cleared"));
                }}
              >
                Reset demo data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
