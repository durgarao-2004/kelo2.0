"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * One-time gate shown before a user's first recording. Consent is recorded
 * server-side (see /api/consent/recording) keyed to the signed-in session,
 * so it can't be forged by a client-supplied flag, and re-appears
 * automatically if RECORDING_CONSENT_VERSION is ever bumped.
 */
export function RecordingConsentGate({
  children,
  initiallyConsented,
}: {
  children: React.ReactNode;
  initiallyConsented: boolean;
}) {
  const [consented, setConsented] = React.useState(initiallyConsented);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (consented) return <>{children}</>;

  async function handleAgree() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/consent/recording", { method: "POST" });
      if (!res.ok) {
        setError("Couldn’t save your consent. Please try again.");
        return;
      }
      setConsented(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">Before you record</h2>
      </div>
      <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        <li>You’re about to record a lecture using your device’s microphone.</li>
        <li>
          Recording another person’s speech (a professor, classmates) may require
          their permission — you are responsible for obtaining any consent required
          by your institution’s policies or local law.
        </li>
        <li>
          Recordings are processed and transcribed by KELO to generate summaries,
          notes, and revision material.
        </li>
        <li>
          Recordings are stored in your own connected Google Drive — KELO does not
          keep a permanent separate copy of the audio.
        </li>
      </ul>
      <p className="text-xs text-muted-foreground">
        Read the full{" "}
        <Link href="/terms" target="_blank" className="underline hover:text-foreground">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button onClick={handleAgree} disabled={pending}>
        {pending ? "Saving…" : "I Agree & Continue"}
      </Button>
    </div>
  );
}
