import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current-user";
import { listSubjects } from "@/server/db/subjects";
import { listSchedule } from "@/server/db/schedule";
import { PageHeader, DataError } from "@/components/app/page-header";
import { TimetableView } from "@/components/timetable/timetable-view";

export const metadata: Metadata = { title: "Timetable" };
export const dynamic = "force-dynamic";

export default async function TimetablePage() {
  const user = await requireUser();
  const [subjectsRes, scheduleRes] = await Promise.all([
    listSubjects(user.id),
    listSchedule(user.id),
  ]);

  const subjects = subjectsRes.data.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
  }));
  const error = subjectsRes.error || scheduleRes.error;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Timetable"
        description="Your recurring weekly class schedule."
      />
      {error ? <DataError message={error} /> : null}
      <TimetableView subjects={subjects} entries={scheduleRes.data} />
    </div>
  );
}
