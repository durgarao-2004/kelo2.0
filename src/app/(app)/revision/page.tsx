import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { listSubjects } from "@/server/db/subjects";
import { listLectures, getLectureDetail } from "@/server/db/lectures";
import { PageHeader, DataError } from "@/components/app/page-header";
import { LectureSummaryView } from "@/components/lectures/lecture-summary-view";
import { AcademicReferenceCard } from "@/components/lectures/academic-reference-card";
import { StatusBadge } from "@/components/lectures/status-badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Revision" };
export const dynamic = "force-dynamic";

/**
 * Pure aggregation over existing data — SELECT SUBJECT -> SELECT LECTURE ->
 * QUICK REVISION. No new AI calls: every field rendered here was already
 * generated during lecture processing (Phase 2) or textbook grounding
 * (Phase 4); this page only organizes it by subject for focused review.
 */
export default async function RevisionPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; lecture?: string }>;
}) {
  const user = await requireUser();
  const { subject: subjectId, lecture: lectureId } = await searchParams;

  // Step 3: a lecture is selected — quick revision view.
  if (lectureId) {
    const { data } = await getLectureDetail(user.id, lectureId);
    if (!data) notFound();
    const { lecture, summary, concepts } = data;
    const backHref = subjectId ? `/revision?subject=${subjectId}` : "/revision";

    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {lecture.title ?? "Untitled lecture"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {lecture.subject?.name ?? "No subject"} · {lecture.recorded_at.slice(0, 10)}
            </p>
          </div>
          <StatusBadge status={lecture.status} />
        </div>

        {!summary ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              This lecture hasn&apos;t been processed yet.{" "}
              <Link href={`/lectures/${lecture.id}`} className="text-primary hover:underline">
                Open it
              </Link>{" "}
              to process it first.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <LectureSummaryView summary={summary} />
            <AcademicReferenceCard concepts={concepts} />
          </div>
        )}
      </div>
    );
  }

  // Step 2: a subject is selected — list its revisable (completed) lectures.
  if (subjectId) {
    const [{ data: subjects }, { data: lectures, error }] = await Promise.all([
      listSubjects(user.id),
      listLectures(user.id, 100),
    ]);
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) notFound();
    const revisable = lectures.filter(
      (l) => l.subject_id === subjectId && l.status === "completed",
    );

    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link
          href="/revision"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Subjects
        </Link>
        <PageHeader title={subject.name} description="Pick a lecture to revise." />
        {error ? <DataError message={error} /> : null}
        {revisable.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No processed lectures for this subject yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {revisable.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/revision?subject=${subjectId}&lecture=${l.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.title ?? "Untitled lecture"}</p>
                    <p className="text-xs text-muted-foreground">{l.recorded_at.slice(0, 10)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Step 1: select a subject.
  const [{ data: subjects, error: subjectsError }, { data: lectures, error: lecturesError }] =
    await Promise.all([listSubjects(user.id), listLectures(user.id, 100)]);
  const error = subjectsError || lecturesError;

  const revisableCounts = new Map<string, number>();
  for (const l of lectures) {
    if (l.status === "completed" && l.subject_id) {
      revisableCounts.set(l.subject_id, (revisableCounts.get(l.subject_id) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader title="Revision" description="Select a subject to start revising." />
      {error ? <DataError message={error} /> : null}
      {subjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Add a subject first.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {subjects.map((s) => {
            const count = revisableCounts.get(s.id) ?? 0;
            const content = (
              <>
                <span
                  className="h-8 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {count > 0
                      ? `${count} lecture${count === 1 ? "" : "s"} ready`
                      : "Nothing to revise yet"}
                  </p>
                </div>
                <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              </>
            );
            return (
              <li key={s.id}>
                {count > 0 ? (
                  <Link
                    href={`/revision?subject=${s.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 opacity-60">
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
