import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, HardDrive } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getLectureDetail } from "@/server/db/lectures";
import { formatDuration } from "@/lib/utils/time";
import { toUserFacingProcessingError } from "@/lib/errors/user-facing";
import { StatusBadge } from "@/components/lectures/status-badge";
import { ProcessButton } from "@/components/lectures/process-button";
import { LectureSummaryView } from "@/components/lectures/lecture-summary-view";
import { AcademicReferenceCard } from "@/components/lectures/academic-reference-card";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Lecture" };
export const dynamic = "force-dynamic";

function driveLink(id: string | null): string | null {
  return id ? `https://drive.google.com/file/d/${id}/view` : null;
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

  const { lecture, transcript, summary, concepts } = data;
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
          <LectureSummaryView summary={summary} />
          <AcademicReferenceCard concepts={concepts} />

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
