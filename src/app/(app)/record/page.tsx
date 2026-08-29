import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { listSubjects } from "@/server/db/subjects";
import { getDriveConnection } from "@/server/db/drive";
import { PageHeader, DataError } from "@/components/app/page-header";
import { Recorder } from "@/components/recording/recorder";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Record" };
export const dynamic = "force-dynamic";

export default async function RecordPage() {
  const user = await requireUser();
  const [subjectsRes, drive] = await Promise.all([
    listSubjects(user.id),
    getDriveConnection(user.id).catch(() => ({
      connected: false,
      googleEmail: null,
      rootFolderId: null,
    })),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Record a lecture"
        description="Capture audio in your browser, then save it to your library."
      />
      {subjectsRes.error ? <DataError message={subjectsRes.error} /> : null}
      {subjectsRes.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">
            Add a subject before recording so lectures are organized correctly.
          </p>
          <Link href="/attendance" className="mt-3 inline-block">
            <Button size="sm">Add a subject</Button>
          </Link>
        </div>
      ) : (
        <Recorder
          subjects={subjectsRes.data.map((s) => ({ id: s.id, name: s.name }))}
          driveConnected={drive.connected}
        />
      )}
    </div>
  );
}
