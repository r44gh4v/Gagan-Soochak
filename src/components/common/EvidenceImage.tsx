"use client";

import { useEffect, useState } from "react";

import { getEvidence } from "@/lib/storage/evidenceStore";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Renders an evidence JPEG from IndexedDB via a managed object URL. */
export function EvidenceImage({
  evidenceKey,
  alt,
  className,
}: {
  evidenceKey: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void getEvidence(evidenceKey).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setMissing(true);
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [evidenceKey]);

  if (missing) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-[10px] text-muted-foreground",
          className,
        )}
      >
        no image
      </div>
    );
  }
  if (!url) return <Skeleton className={className} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={cn("object-cover", className)} />;
}
