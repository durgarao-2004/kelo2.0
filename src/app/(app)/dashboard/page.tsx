import type { Metadata } from "next";
import Link from "next/link";
import { HardDrive, Library, TrendingUp, AlertTriangle, BookOpen } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { listSchedule } from "@/server/db/schedule";
import { attendanceSummary } from "@/server/db/attendance";
import { listLectures, listLecturesNeedingAttention } from "@/server/db/lectures";
import { getDriveConnection } from "@/server/db/drive";
import { overallAttendance } from "@/features/attendance/calc";
import { Greeting } from "@/components/dashboard/greeting";
import { TodayTimeline } from "@/components/dashboard/today-timeline";
import { DashboardNotifier } from "@/components/dashboard/dashboard-notifier";
import { AttendanceRing } from "@/components/attendance/attendance-ring";
import { StatusBadge } from "@/components/lectures/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataError } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [scheduleRes, attRes, lecturesRes, attentionRes, drive] = await Promise.all([
    listSchedule(user.id),
    attendanceSummary(user.id),
    listLectures(user.id, 5),
    listLecturesNeedingAttention(user.id),
    getDriveConnection(user.id).catch(() => ({
      connected: false,
      googleEmail: null,
      rootFolderId: null,
    })),
  ]);

  const totalSessions = attRes.data.reduce((sum, s) => sum + (s.stats.totalSessions ?? 0), 0);
  const overall = overallAttendance(
    attRes.data.map((s) => ({
      attended: s.stats.attended,
      conducted: s.stats.conducted,
    })),
    75,
    totalSessions,
  );
  const atRisk = attRes.data.filter((s) => s.stats.status === "warning");
  const revisableCount = lecturesRes.data.filter((l) => l.status === "completed").length;
  const error = scheduleRes.error || attRes.error || lecturesRes.error;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Greeting email={user.email} />
        <p className="mt-1 text-sm text-muted-foreground">
          Here’s your day at a glance.
        </p>
      </div>

      {error ? <DataError message={error} /> : null}

      <DashboardNotifier schedule={scheduleRes.data} attendance={attRes.data} />

      {attentionRes.data.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-warning/30 bg-warning/10 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-warning" /> Needs attention
          </p>
          <ul className="space-y-2">
            {attentionRes.data.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/lectures/${l.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-sm hover:border-primary/40"
                >
                  <span className="truncate">
                    {l.title ?? "Untitled lecture"}
                    {l.subject?.name ? ` · ${l.subject.name}` : ""}
                  </span>
                  <StatusBadge status={l.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodayTimeline entries={scheduleRes.data} />
        </div>

        <div className="space-y-6">
          {/* Attendance */}
          <Card>
            <CardContent>
              <div className="flex items-center gap-4">
                <AttendanceRing
                  percentage={overall.percentage}
                  status={overall.status}
                  size={84}
                />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Overall attendance
                  </p>
                  <p className="text-2xl font-semibold">
                    {overall.percentage === null ? "—" : `${overall.percentage}%`}
                  </p>
                  <Link
                    href="/attendance"
                    className="text-xs text-primary hover:underline"
                  >
                    View by subject
                  </Link>
                </div>
              </div>
              {overall.status !== "no_data" ? (
                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Present</dt>
                    <dd className="font-medium">{overall.attended}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Absent</dt>
                    <dd className="font-medium">{overall.missed}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Conducted</dt>
                    <dd className="font-medium">
                      {overall.conducted}
                      {overall.totalSessions ? ` / ${overall.totalSessions}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Remaining</dt>
                    <dd className="font-medium">{overall.remaining ?? "—"}</dd>
                  </div>
                </dl>
              ) : null}
            </CardContent>
          </Card>

          {/* Revision entry point */}
          <Card>
            <CardContent>
              <p className="mb-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BookOpen className="h-4 w-4" /> Revision
              </p>
              {revisableCount > 0 ? (
                <p className="text-sm">
                  {revisableCount} recent lecture{revisableCount === 1 ? "" : "s"} ready to
                  revise.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Process a lecture to unlock revision material.
                </p>
              )}
              <Link href="/revision" className="mt-2 inline-block text-xs text-primary hover:underline">
                Start revising
              </Link>
            </CardContent>
          </Card>

          {/* Insights (derived, not fabricated) */}
          <Card>
            <CardContent>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-4 w-4" /> Insights
              </p>
              {atRisk.length === 0 ? (
                <p className="text-sm">
                  {overall.status === "no_data"
                    ? "Start marking attendance to see insights."
                    : "You’re on track across all subjects."}
                </p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {atRisk.slice(0, 3).map((s) => (
                    <li key={s.subjectId} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      <span>
                        <span className="font-medium">{s.name}</span> is at{" "}
                        {s.stats.percentage}% —{" "}
                        {s.stats.classesToTarget
                          ? `attend ${s.stats.classesToTarget} more.`
                          : `below ${s.stats.requiredPercent}%.`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Google Drive */}
          <Card>
            <CardContent>
              <p className="mb-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <HardDrive className="h-4 w-4" /> Google Drive
              </p>
              {drive.connected ? (
                <p className="text-sm">
                  Connected{drive.googleEmail ? ` as ${drive.googleEmail}` : ""}.
                  Recordings auto-organize into your KELO folders.
                </p>
              ) : (
                <p className="text-sm">
                  Connect Drive to auto-organize recordings, transcripts, and
                  summaries.
                </p>
              )}
              <Link
                href="/settings"
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                Manage in Settings
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent lectures */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Library className="h-5 w-5" /> Recent lectures
          </h2>
          <Link href="/lectures" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        {lecturesRes.data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No recordings yet. Your recorded lectures will appear here.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {lecturesRes.data.map((l) => (
              <li key={l.id} className="flex items-center gap-3 bg-card p-4">
                <span
                  className="h-8 w-1.5 rounded-full"
                  style={{ backgroundColor: l.subject?.color ?? "#4f46e5" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {l.title ?? "Untitled lecture"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.subject?.name ?? "No subject"} · {l.recorded_at.slice(0, 10)}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                  {l.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
