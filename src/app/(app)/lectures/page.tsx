import type { Metadata } from "next";
import Link from "next/link";
import { Mic, Clock } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { listLectures } from "@/server/db/lectures";
import { formatDuration } from "@/lib/utils/time";
import { PageHeader, DataError } from "@/components/app/page-header";
import { StatusBadge } from "@/components/lectures/status-badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Lectures" };
export const dynamic = "force-dynamic";

export default async function LecturesPage() {
  const user = await requireUser();
  const { data, error } = await listLectures(user.id, 100);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Lectures"
        description="Your recorded lectures, transcripts, and summaries."
        action={
          <Link href="/record">
            <Button size="sm">
              <Mic className="h-4 w-4" /> Record
            </Button>
          </Link>
        }
      />
      {error ? <DataError message={error} /> : null}

      {data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">No lectures yet.</p>
          <Link href="/record" className="mt-3 inline-block">
            <Button size="sm">Record your first lecture</Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((l) => (
            <li key={l.id}>
              <Link
                href={`/lectures/${l.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40"
              >
                <span
                  className="h-10 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: l.subject?.color ?? "#4f46e5" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {l.title ?? "Untitled lecture"}
                  </p>
                  <p className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{l.subject?.name ?? "No subject"}</span>
                    <span>{l.recorded_at.slice(0, 10)}</span>
                    {l.duration_seconds > 0 ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(l.duration_seconds)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <StatusBadge status={l.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
