import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, HardDrive, BookOpen } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getLectureDetail } from "@/server/db/lectures";
import { formatDuration } from "@/lib/utils/time";
import { toUserFacingProcessingError } from "@/lib/errors/user-facing";
import { StatusBadge } from "@/components/lectures/status-badge";
import { ProcessButton } from "@/components/lectures/process-button";
import { Card, CardContent } from "@/components/ui/card";
import { getTextbookByKey, formatTextbookCitation } from "@/config/textbooks";

export const metadata: Metadata = { title: "Lecture" };
export const dynamic = "force-dynamic";

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function driveLink(id: string | null): string | null {
  return id ? `https://drive.google.com/file/d/${id}/view` : null;
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

interface NoteSection {
  heading: string;
  points: string[];
}

function asNoteSections(value: unknown): NoteSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const heading = (v as { heading?: unknown })?.heading;
      const points = asStringList((v as { points?: unknown })?.points);
      return typeof heading === "string" && heading.trim() && points.length > 0
        ? { heading, points }
        : null;
    })
    .filter((v): v is NoteSection => v !== null);
}

interface Definition {
  term: string;
  definition: string;
}

function asDefinitions(value: unknown): Definition[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const term = (v as { term?: unknown })?.term;
      const definition = (v as { definition?: unknown })?.definition;
      return typeof term === "string" && typeof definition === "string" && term.trim()
        ? { term, definition }
        : null;
    })
    .filter((v): v is Definition => v !== null);
}

export default async function LectureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { data } = await getLectureDetail(user.id, id);
  if (!data) notFound();

  const { lecture, transcript, summary, concepts: textbookConcepts } = data;
  const verifiedConcepts = textbookConcepts
    .filter((c) => c.textbook_status === "verified" && c.textbook_subject_key)
    .map((c) => ({
      concept: c.concept,
      lectureConnection: c.lecture_connection,
      explanation: c.textbook_explanation,
      textbook: getTextbookByKey(c.textbook_subject_key!),
    }))
    .filter((c) => c.textbook !== null);
  const revision = (summary?.revision ?? {}) as {
    examQuestions?: unknown;
    flashcards?: unknown;
    quickReview?: unknown;
  };
  const flashcards = Array.isArray(revision.flashcards)
    ? (revision.flashcards as Array<{ q?: unknown; a?: unknown }>).filter(
        (c) => typeof c.q === "string" && typeof c.a === "string",
      )
    : [];
  const notes = asNoteSections(summary?.notes);
  const definitions = asDefinitions(summary?.definitions);
  const examples = asStringList(summary?.examples);

  const hasAnalysis = Boolean(summary);
  const recDrive = driveLink(lecture.drive_recording_file_id);
  const tDrive = driveLink(lecture.drive_transcript_file_id);
  const sDrive = driveLink(lecture.drive_summary_file_id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/lectures"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Lectures
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: lecture.subject?.color ?? "#4f46e5" }}
            />
            <h1 className="text-2xl font-semibold tracking-tight">
              {lecture.title ?? "Untitled lecture"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {lecture.subject?.name ?? "No subject"} · {lecture.recorded_at.slice(0, 10)}
            {lecture.duration_seconds > 0
              ? ` · ${formatDuration(lecture.duration_seconds)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={lecture.status} />
          {!hasAnalysis ? (
            <ProcessButton
              lectureId={lecture.id}
              label={lecture.error ? "Retry processing" : "Transcribe & summarize"}
            />
          ) : (
            <ProcessButton lectureId={lecture.id} label="Re-process" force />
          )}
        </div>
      </div>

      {lecture.error ? (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          {toUserFacingProcessingError(lecture.error)}
        </div>
      ) : null}

      {/* Drive links */}
      {recDrive || tDrive || sDrive ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {recDrive ? (
            <a href={recDrive} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1 text-xs hover:bg-secondary/70">
              <HardDrive className="h-3.5 w-3.5" /> Recording
            </a>
          ) : null}
          {tDrive ? (
            <a href={tDrive} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1 text-xs hover:bg-secondary/70">
              <FileText className="h-3.5 w-3.5" /> Transcript
            </a>
          ) : null}
          {sDrive ? (
            <a href={sDrive} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1 text-xs hover:bg-secondary/70">
              <FileText className="h-3.5 w-3.5" /> Summary
            </a>
          ) : null}
        </div>
      ) : null}

      {!hasAnalysis ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            No transcript or summary yet. Once your recording is processed, the
            summary, key concepts, and revision material appear here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {summary?.summary ? (
            <Card>
              <CardContent>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Summary</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {summary.summary}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {notes.length > 0 ? (
            <Card>
              <CardContent className="space-y-5">
                <h2 className="text-sm font-semibold text-muted-foreground">Notes</h2>
                {notes.map((section, i) => (
                  <Section key={i} title={section.heading} items={section.points} />
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="space-y-5">
              <Section title="Key concepts" items={asStringList(summary?.key_concepts)} />
              {definitions.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                    Definitions
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {definitions.map((d, i) => (
                      <li key={i}>
                        <span className="font-medium">{d.term}:</span>{" "}
                        <span className="text-foreground/90">{d.definition}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Section title="Examples" items={examples} />
              <Section title="Important points" items={asStringList(summary?.important_points)} />
              <Section title="Topics" items={asStringList(summary?.topics)} />
            </CardContent>
          </Card>

          {verifiedConcepts.length > 0 ? (
            <Card>
              <CardContent className="space-y-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <BookOpen className="h-4 w-4" /> Academic reference
                </h2>
                <p className="text-xs text-muted-foreground">
                  Textbook-grounded explanations, kept separate from what your professor
                  actually said — the lecture and the textbook aren&apos;t always identical.
                </p>
                <div className="space-y-4">
                  {verifiedConcepts.map((c, i) => (
                    <div key={i} className="rounded-xl border border-border p-4">
                      <p className="font-medium">{c.concept}</p>
                      <p className="mt-1 text-xs font-medium text-primary">
                        {formatTextbookCitation(c.textbook!)}
                      </p>
                      {c.explanation ? (
                        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                          {c.explanation}
                        </p>
                      ) : null}
                      {c.lectureConnection ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">From your lecture: </span>
                          {c.lectureConnection}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {(asStringList(revision.examQuestions).length > 0 ||
            flashcards.length > 0 ||
            asStringList(revision.quickReview).length > 0) ? (
            <Card>
              <CardContent className="space-y-5">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Revision material
                </h2>
                <Section title="Likely exam questions" items={asStringList(revision.examQuestions)} />
                {flashcards.length > 0 ? (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                      Flashcards
                    </h3>
                    <ul className="space-y-2">
                      {flashcards.map((c, i) => (
                        <li key={i} className="rounded-lg border border-border p-3 text-sm">
                          <p className="font-medium">{String(c.q)}</p>
                          <p className="mt-1 text-muted-foreground">{String(c.a)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <Section title="Quick review" items={asStringList(revision.quickReview)} />
              </CardContent>
            </Card>
          ) : null}

          {transcript ? (
            <details className="rounded-2xl border border-border bg-card p-5">
              <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
                Full transcript
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {transcript}
              </p>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}
