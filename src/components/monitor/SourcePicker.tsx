"use client";

import { Film, Upload } from "lucide-react";
import { useRef } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SAMPLE_CLIPS } from "@/lib/mock/clips";
import { useSessionStore } from "@/store/session";
import { cn } from "@/lib/utils";

export type VideoSource = {
  url: string;
  label: string;
  routeId: string;
  isUpload: boolean;
};

export function SourcePicker({
  current,
  onSelect,
}: {
  current: VideoSource | null;
  onSelect: (src: VideoSource) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const patrolStartIso = useSessionStore((s) => s.patrolStartIso);
  const setPatrolStartIso = useSessionStore((s) => s.setPatrolStartIso);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("video/")) return;
    onSelect({
      url: URL.createObjectURL(file),
      label: file.name,
      routeId: "ec-hosur-road", // no route binding for uploads - assumed, disclosed
      isUpload: true,
    });
  };

  // datetime-local wants local time without zone
  const localValue = (() => {
    const d = new Date(patrolStartIso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <div className="flex flex-wrap items-end gap-3">
      {SAMPLE_CLIPS.map((clip) => (
        <button
          key={clip.src}
          type="button"
          onClick={() =>
            onSelect({
              url: clip.src,
              label: clip.label.split(" - ")[0],
              routeId: clip.routeId,
              isUpload: false,
            })
          }
          className={cn(
            "flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm hover:border-primary/60",
            current?.url === clip.src && "border-primary ring-1 ring-primary/30",
          )}
        >
          <Film className="size-4 text-muted-foreground" />
          <span>
            <span className="block font-medium leading-tight">
              {clip.label.split(" - ")[0]}
            </span>
            <span className="block text-xs leading-tight text-muted-foreground">
              {clip.label.split(" - ")[1]}
            </span>
          </span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        className={cn(
          "flex items-center gap-2 rounded-md border border-dashed bg-card px-3 py-2 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground",
          current?.isUpload && "border-primary text-foreground ring-1 ring-primary/30",
        )}
      >
        <Upload className="size-4" />
        {current?.isUpload ? current.label : "Drop or choose an .mp4"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <div className="ml-auto flex items-center gap-2">
        <Label htmlFor="patrol-start" className="text-xs text-muted-foreground">
          Patrol start
        </Label>
        <Input
          id="patrol-start"
          type="datetime-local"
          value={localValue}
          onChange={(e) => {
            const d = new Date(e.target.value);
            if (!Number.isNaN(d.getTime())) setPatrolStartIso(d.toISOString());
          }}
          className="h-8 w-52 text-xs"
        />
      </div>
    </div>
  );
}
