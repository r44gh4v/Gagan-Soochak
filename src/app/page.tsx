"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Cold visitor → /monitor (the detection demo). Returning operator with
 * incidents in the queue → /incidents (their work). Client-side because the
 * decision reads persisted localStorage state.
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let hasIncidents = false;
    try {
      const raw = localStorage.getItem("gagan-soochak-incidents");
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { order?: string[] } };
        hasIncidents = (parsed.state?.order?.length ?? 0) > 0;
      }
    } catch {
      // fall through to monitor
    }
    router.replace(hasIncidents ? "/incidents" : "/monitor");
  }, [router]);

  return null;
}
