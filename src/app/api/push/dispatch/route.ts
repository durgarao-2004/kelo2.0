import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getPushConfig, sendPushToUser } from "@/server/push/send";
import { claimPushDedupe } from "@/server/db/push";
import { classStatus } from "@/features/timetable/overlap";
import { computeAttendanceFromRecords } from "@/features/attendance/calc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-triggered notification sweep: upcoming class reminders + attendance
 * warnings, for every user, across the whole account base. There's no
 * in-process scheduler in this stack (serverless functions don't stay
 * running), so this is meant to be invoked periodically by an external
 * trigger — e.g. Vercel Cron every 5 minutes, see vercel.json — authenticated
 * with a shared secret rather than a user session, since no user is signed
 * in when it runs.
 *
 * KNOWN LIMITATION: "now" is the server's own clock — there is no per-user
 * timezone column on `users`/`subjects`, so this assumes the deployment's
 * server timezone matches students' local time. Documented, not silently
 * wrong: a genuinely correct multi-timezone version needs a timezone field
 * added to the schema, which is out of scope for this pass.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` on GET; a manual
  // trigger (curl, another scheduler) can use the `x-cron-secret` header —
  // either is accepted so this isn't tied to one hosting provider's convention.
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  return handleDispatch(request);
}

export async function POST(request: Request) {
  return handleDispatch(request);
}

async function handleDispatch(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const config = getPushConfig();
  if (!config) {
    return Response.json({ error: "push_not_configured" }, { status: 503 });
  }

  const db = getSupabaseAdmin();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dow = now.getDay();
  const nowMinute = now.getHours() * 60 + now.getMinutes();

  let classReminders = 0;
  let attendanceWarnings = 0;

  // ---- Upcoming class reminders ----
  interface ReminderEntry {
    id: string;
    user_id: string;
    day_of_week: number;
    start_minute: number;
    end_minute: number;
    location: string | null;
    subject: { name: string } | { name: string }[] | null;
  }
  const { data: entriesRaw } = await db
    .from("schedule_entries")
    .select("id, user_id, day_of_week, start_minute, end_minute, location, subject:subjects(name)")
    .eq("day_of_week", dow);
  const entries = (entriesRaw as unknown as ReminderEntry[] | null) ?? [];

  for (const e of entries) {
    if (classStatus(e.start_minute, e.end_minute, nowMinute) !== "starting_soon") continue;
    const key = `class-${e.id}-${today}`;
    const claimed = await claimPushDedupe(e.user_id, key);
    if (!claimed) continue;

    const subjectName =
      (Array.isArray(e.subject) ? e.subject[0]?.name : e.subject?.name) ?? "Class";
    const hh = String(Math.floor(e.start_minute / 60)).padStart(2, "0");
    const mm = String(e.start_minute % 60).padStart(2, "0");
    const result = await sendPushToUser(e.user_id, {
      title: `${subjectName} starting soon`,
      body: `Starts at ${hh}:${mm}${e.location ? ` · ${e.location}` : ""}`,
      url: "/timetable",
      tag: key,
    });
    if (result.sent > 0) classReminders++;
  }

  // ---- Attendance warnings (once per subject per day) ----
  const [{ data: subjects }, { data: records }] = await Promise.all([
    db.from("subjects").select("id, user_id, name, target_attendance, total_sessions"),
    db.from("attendance_records").select("subject_id, status"),
  ]);

  const bySubject = new Map<string, { status: "attended" | "missed" | "cancelled" }[]>();
  for (const r of records ?? []) {
    const list = bySubject.get(r.subject_id) ?? [];
    list.push({ status: r.status as "attended" | "missed" | "cancelled" });
    bySubject.set(r.subject_id, list);
  }

  for (const s of subjects ?? []) {
    const stats = computeAttendanceFromRecords(
      bySubject.get(s.id) ?? [],
      Number(s.target_attendance),
      Number(s.total_sessions),
    );
    if (stats.status !== "warning") continue;
    const key = `attendance-warn-${s.id}-${today}`;
    const claimed = await claimPushDedupe(s.user_id, key);
    if (!claimed) continue;

    const result = await sendPushToUser(s.user_id, {
      title: `${s.name} attendance at risk`,
      body: `You're at ${stats.percentage}%, below the required ${stats.requiredPercent}%.`,
      url: "/attendance",
      tag: key,
    });
    if (result.sent > 0) attendanceWarnings++;
  }

  return Response.json({ ok: true, classReminders, attendanceWarnings });
}
