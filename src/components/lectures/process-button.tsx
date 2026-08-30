"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/features/notifications/notify";

/**
 * Triggers the transcription/analysis pipeline for a lecture and refreshes the
 * view. Safe to retry (idempotent server-side).
 */
export function ProcessButton({
  lectureId,
  label = "Process",
  variant = "secondary",
  force = false,
}: {
  lectureId: string;
  label?: string;
  variant?: "primary" | "secondary";
  /** Redo analysis even though it already succeeded (the transcript is
   * reused — only the AI analysis + summary file are regenerated). */
  force?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/recordings/${lectureId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const message =
          data.error === "already_processing"
            ? "Already processing — check back in a moment."
            : (data.error ?? `Failed (${res.status}).`);
        setError(message);
        if (data.error !== "already_processing") {
          notify("Lecture processing failed", { body: message });
        }
      } else {
        notify("Lecture ready", { body: "Transcript and summary are ready to view." });
        router.refresh();
      }
    } catch {
      setError("Network error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" variant={variant} onClick={run} disabled={pending}>
        {pending ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {pending ? "Working…" : label}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
