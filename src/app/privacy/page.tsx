import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to KELO
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated: 2026-08-30</p>

      <div className="mt-8 space-y-8">
        <Section title="What we store">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your email address and a hash of your 6-digit PIN — never the PIN itself.</li>
            <li>Subjects, timetable entries, and attendance records you enter.</li>
            <li>
              Lecture metadata (title, subject, duration, processing status) and the
              generated transcript/summary/notes text.
            </li>
            <li>
              An encrypted Google OAuth token, used only to upload recordings and
              generated files to your own Drive.
            </li>
            <li>Whether you&apos;ve accepted the recording-consent notice, and when.</li>
            <li>
              If you turn on notifications: a push subscription (an opaque endpoint
              URL and encryption keys assigned by your browser) tied to your
              account, used only to deliver KELO&apos;s own notifications to that
              device — not to identify or track you elsewhere.
            </li>
          </ul>
        </Section>

        <Section title="What we don't permanently store">
          <p>
            Recorded audio is held only long enough to upload it to your connected
            Google Drive and to run transcription — it is not kept as a separate
            permanent copy on KELO&apos;s servers once that&apos;s done. The
            recording itself lives in your Drive, under your Google account&apos;s
            own storage and sharing controls.
          </p>
        </Section>

        <Section title="Third parties involved in processing">
          <p>
            To turn a recording into a transcript and study material, audio and
            transcript text are sent to the transcription and AI providers KELO is
            configured to use at the time (for example, for speech-to-text and for
            summarization). These providers process that data under their own terms
            to return a result to KELO; KELO does not sell your data or share it for
            advertising.
          </p>
        </Section>

        <Section title="Your Google Drive connection">
          <p>
            Connecting Drive grants KELO permission to create and write files inside
            a KELO folder in your Drive. You can disconnect Drive at any time from
            Settings, which stops KELO from accessing it further.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Deleting a subject or lecture from KELO removes its records from
            KELO&apos;s database. Files already saved to your Google Drive are not
            automatically deleted from Drive — remove those directly in Drive if you
            want them gone entirely.
          </p>
        </Section>

        <Section title="No compliance claims">
          <p>
            KELO is a small, independently run tool. We have not sought or obtained
            certification under GDPR, FERPA, or any other specific data-protection
            or education-records framework. If your institution or jurisdiction
            requires that, verify independently whether KELO is suitable for your
            use before relying on it for that purpose.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If how we handle your data changes in a way that affects recording
            consent specifically, you&apos;ll be asked to re-accept the recording
            notice before your next recording.
          </p>
        </Section>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        See also the <Link href="/terms" className="underline hover:text-foreground">Terms of Service</Link>.
      </p>
    </div>
  );
}
