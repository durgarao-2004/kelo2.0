import { BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getTextbookByKey, formatTextbookCitation } from "@/config/textbooks";
import type { LectureConceptRow } from "@/server/db/lectures";

/**
 * Renders only concepts confirmed against a configured textbook
 * (`textbook_status === "verified"`) — never an unverified/pending match —
 * and keeps the textbook explanation visually separate from the lecture
 * connection line, so the two sources are never mistaken for each other.
 * Renders nothing when there's nothing verified (no empty-card clutter).
 */
export function AcademicReferenceCard({ concepts }: { concepts: LectureConceptRow[] }) {
  const verified = concepts
    .filter((c) => c.textbook_status === "verified" && c.textbook_subject_key)
    .map((c) => ({
      concept: c.concept,
      lectureConnection: c.lecture_connection,
      explanation: c.textbook_explanation,
      textbook: getTextbookByKey(c.textbook_subject_key!),
    }))
    .filter((c) => c.textbook !== null);

  if (verified.length === 0) return null;

  return (
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
          {verified.map((c, i) => (
            <div key={i} className="rounded-xl border border-border p-4">
              <p className="font-medium">{c.concept}</p>
              <p className="mt-1 text-xs font-medium text-primary">
                {formatTextbookCitation(c.textbook!)}
              </p>
              {c.explanation ? (
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">{c.explanation}</p>
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
  );
}
