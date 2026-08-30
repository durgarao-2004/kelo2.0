import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of Service" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to KELO
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated: 2026-08-30</p>

      <div className="mt-8 space-y-8">
        <Section title="What KELO is">
          <p>
            KELO is a personal study tool for recording lectures in your browser and
            turning them into transcripts, summaries, and revision material. It is
            provided as-is, for personal academic use.
          </p>
        </Section>

        <Section title="Recording lectures and other people">
          <p>
            When you record a lecture, you may be recording a professor or other
            people speaking. <strong className="text-foreground">You are solely
            responsible</strong> for knowing and following the recording-consent
            rules that apply to you — your institution&apos;s policies and the laws
            of your location. KELO does not determine whether recording a given
            class is permitted; it only provides the recording tool.
          </p>
        </Section>

        <Section title="How your recordings are handled">
          <p>
            Audio you record is uploaded to KELO&apos;s servers only long enough to
            be processed, then stored in{" "}
            <strong className="text-foreground">your own connected Google Drive</strong>{" "}
            (KELO does not keep a permanent copy of the audio itself). Transcription
            and AI analysis (summaries, key concepts, definitions, revision material)
            are performed by third-party providers KELO integrates with; only the
            audio and transcript text needed to produce that output is sent to them.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            KELO accounts use an email address and a 6-digit PIN. You&apos;re
            responsible for keeping your PIN and your Google Drive connection
            secure, and for the accuracy of the subjects, timetable, and attendance
            records you enter.
          </p>
        </Section>

        <Section title="No warranty">
          <p>
            Transcripts and AI-generated notes can be incomplete or inaccurate —
            always verify anything you intend to rely on academically. KELO is
            provided without warranty of any kind, and we make no claim of
            compliance with any specific data-protection or education-records
            regulation; if your institution has specific requirements, confirm
            independently whether KELO meets them before relying on it.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            These terms may change as KELO changes. Material changes that affect
            recording consent will prompt you to re-accept the recording notice
            before your next recording.
          </p>
        </Section>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        See also the <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
      </p>
    </div>
  );
}
