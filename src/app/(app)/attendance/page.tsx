import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current-user";
import { attendanceSummary } from "@/server/db/attendance";
import { PageHeader, DataError } from "@/components/app/page-header";
import { AddSubjectForm } from "@/components/attendance/add-subject-form";
import { SubjectList } from "@/components/attendance/subject-list";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const user = await requireUser();
  const { data, error } = await attendanceSummary(user.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Attendance"
        description="Track each subject against its required percentage."
        action={<AddSubjectForm />}
      />
      {error ? <DataError message={error} /> : null}
      <SubjectList items={data} />
    </div>
  );
}
