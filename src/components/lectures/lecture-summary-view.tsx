import { asStringArray, asNoteSections, asDefinitions, asFlashcards } from "@/features/ai/parse";
import { Card, CardContent } from "@/components/ui/card";
import type { SummaryRow } from "@/server/db/lectures";

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

/**
 * The lecture-derived "quick revision" view: summary, structured notes, key
 * concepts/definitions/examples/important points, and AI-generated revision
 * material (exam questions, flashcards, quick review) — all grounded in the
 * lecture transcript, never the textbook (see AcademicReferenceCard for
 * that, kept as a visually separate block wherever both appear). Shared
 * between the lecture detail page and the Revision flow so both render this
 * content identically instead of maintaining two copies.
 */
export function LectureSummaryView({ summary }: { summary: SummaryRow | null }) {
  if (!summary) return null;

  const revision = (summary.revision ?? {}) as {
    examQuestions?: unknown;
    flashcards?: unknown;
    quickReview?: unknown;
  };
  const examQuestions = asStringArray(revision.examQuestions);
  const flashcards = asFlashcards(revision.flashcards);
  const quickReview = asStringArray(revision.quickReview);
  const notes = asNoteSections(summary.notes);
  const definitions = asDefinitions(summary.definitions);
  const examples = asStringArray(summary.examples);
  const hasRevisionMaterial =
    examQuestions.length > 0 || flashcards.length > 0 || quickReview.length > 0;

  return (
    <>
      {summary.summary ? (
        <Card>
          <CardContent>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Summary</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{summary.summary}</p>
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
          <Section title="Key concepts" items={asStringArray(summary.key_concepts)} />
          {definitions.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Definitions</h3>
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
          <Section title="Important points" items={asStringArray(summary.important_points)} />
          <Section title="Topics" items={asStringArray(summary.topics)} />
        </CardContent>
      </Card>

      {hasRevisionMaterial ? (
        <Card>
          <CardContent className="space-y-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Revision material</h2>
            <Section title="Likely exam questions" items={examQuestions} />
            {flashcards.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Flashcards</h3>
                <ul className="space-y-2">
                  {flashcards.map((c, i) => (
                    <li key={i} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium">{c.q}</p>
                      <p className="mt-1 text-muted-foreground">{c.a}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Section title="Quick review" items={quickReview} />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
