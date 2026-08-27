"use client";

import { Radar, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { ModelStatusChip } from "@/components/layout/ModelStatusChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
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
  const active = all.filter((i) => ACTIVE_STATUSES.includes(i.status));
  const p1 = active.filter((i) => i.priority === "P1").length;

  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-card">
      <div className="flex h-full items-center gap-4 px-4">
        <Link href="/monitor" className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Radar className="size-4" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-semibold leading-tight">
              Gagan Soochak
            </span>
            <span className="block text-[11px] leading-tight text-muted-foreground">
              Electronic City · Track 2
            </span>
          </span>
        </Link>

        <Separator orientation="vertical" className="hidden h-6 sm:block" />

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {all.length > 0 && (
            <Link href="/incidents" className="flex items-center gap-1.5">
              <Badge variant="secondary" className="tabular-nums font-normal">
                {active.length} active
              </Badge>
              {p1 > 0 && (
                <Badge
                  variant="outline"
                  className="border-[#fecaca] bg-[#fef2f2] tabular-nums font-medium text-[#b91c1c]"
                >
                  {p1} P1
                </Badge>
              )}
            </Link>
          )}

          <ModelStatusChip />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <Settings2 className="size-4" />
                <span className="sr-only">Session options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Demo data</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  void (async () => {
                    const { buildSeedIncidents } = await import("@/lib/mock/seed");
                    const { defaultPatrolStart } = await import("@/lib/mock/time");
                    const seeded = await buildSeedIncidents(defaultPatrolStart());
                    useIncidentStore.getState().loadIncidents(seeded);
                    toast(`Loaded ${seeded.length} seeded incidents`, {
                      description: "Badged SEED DATA - separate from real detections",
                    });
                  })();
                }}
              >
                Load seeded incidents
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  void clearAll().then(() => toast("All incidents deleted"));
                }}
              >
                Delete all incidents
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
