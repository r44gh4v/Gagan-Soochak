"use client";

import { Upload } from "lucide-react";
import { useId, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SAMPLE_CLIPS } from "@/lib/mock/clips";
import { useSessionStore } from "@/store/session";

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
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const patrolStartIso = useSessionStore((s) => s.patrolStartIso);
  const setPatrolStartIso = useSessionStore((s) => s.setPatrolStartIso);

  const handleFile = (file: File) => {
    // Some browsers report an empty type for less common containers, so only
    // reject when we positively know it is not a video.
    if (file.type && !file.type.startsWith("video/")) {
      toast.error("That file is not a video", { description: file.name });
      return;
    }
    onSelect({
      url: URL.createObjectURL(file),
      label: file.name,
      routeId: "ec-hosur-road", // uploads have no route binding - assumed, disclosed
      isUpload: true,
    });
  };

  // datetime-local expects local time with no zone suffix
  const localValue = (() => {
    const d = new Date(patrolStartIso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file?.type.startsWith("video/")) handleFile(file);
      }}
    >
      <span className="text-xs text-muted-foreground">Source</span>

      {SAMPLE_CLIPS.map((clip) => (
        <Button
          key={clip.src}
          type="button"
          size="sm"
          variant={current?.url === clip.src ? "default" : "outline"}
          onClick={() =>
            onSelect({
              url: clip.src,
              label: clip.file,
              routeId: clip.routeId,
              isUpload: false,
            })
          }
        >
          {clip.label}
        </Button>
      ))}

      {/* Standard hidden-input + label pattern: the label is the click target,
          so no programmatic .click() and no browser-blocked dialog. */}
      <Button asChild size="sm" variant={current?.isUpload ? "default" : "outline"}>
        <Label htmlFor={inputId} className="cursor-pointer font-normal">
          <Upload className="size-3.5" />
          {current?.isUpload ? current.label : "Upload your own video"}
        </Label>
      </Button>
      <input
        id={inputId}
        ref={fileRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.m4v,.mkv,.avi"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // reset so re-picking the same file still fires change
          e.target.value = "";
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
          className="h-8 w-[15rem] text-xs"
        />
      </div>
    </div>
  );
}
