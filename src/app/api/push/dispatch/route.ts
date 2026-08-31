import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getPushConfig, sendPushToUser } from "@/server/push/send";
import { claimPushDedupe } from "@/server/db/push";
import { computeAttendanceFromRecords } from "@/features/attendance/calc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How long before a class's start time it becomes eligible for a reminder.
const REMINDER_WINDOW_MIN = 15;
// How long AFTER a class ends we'll still bother sending a late "reminder"
// that a sparse dispatch cadence caused us to miss, before giving up on it
// entirely (a "starting soon" push for a class that ended hours ago would be
// noise, not a reminder). This is what makes the sweep safe to run
// infrequently: any run picks up everything that became due since the
// previous one, bounded by this cutoff, instead of only the instant it
// happens to fire at.
const CATCH_UP_GRACE_MIN = 120;

/**
 * Server-triggered notification sweep: upcoming class reminders + attendance
 * warnings, for every user, across the whole account base. There's no
 * in-process scheduler in this stack (serverless functions don't stay
 * running), so this is invoked by an external trigger and authenticated with
 * a shared secret rather than a user session, since no user is signed in
 * when it runs.
 *
 * CADENCE / HOBBY PLAN LIMITATION — read before changing vercel.json:
 * Vercel Cron on the Hobby plan can run AT MOST once per day; a 5-minute
 * schedule is rejected at deploy time. `vercel.json` therefore schedules
 * this once daily, which is enough for the attendance-warning check (not
 * time-of-day sensitive — the per-day dedupe key already caps it at one per
 * subject per day no matter how often this runs) but is NOT enough for real
 * "class starting in 15 minutes" reminders — one sample a day cannot hit a
 * 15-minute window for classes scattered across the day. This route does not
 * pretend otherwise: the eligibility check below is deliberately widened
 * (REMINDER_WINDOW_MIN before start, through CATCH_UP_GRACE_MIN after end)
 * and idempotent (claimPushDedupe, keyed per class per day) specifically so
 * it's safe to invoke MORE often than Vercel's own cron allows, from
 * anywhere. For real near-real-time class reminders, point a free external
 * scheduler (e.g. cron-job.org, a GitHub Actions scheduled workflow,
 * UptimeRobot) at this same path every ~5 minutes, authenticated with
 * `x-cron-secret: $CRON_SECRET` — no application changes required to add
 * that; this route is already cadence-agnostic.
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
    const dueFrom = e.start_minute - REMINDER_WINDOW_MIN;
    const dueUntil = e.end_minute + CATCH_UP_GRACE_MIN;
    if (nowMinute < dueFrom || nowMinute > dueUntil) continue;
    const key = `class-${e.id}-${today}`;
    const claimed = await claimPushDedupe(e.user_id, key);
    if (!claimed) continue;

    const subjectName =
      (Array.isArray(e.subject) ? e.subject[0]?.name : e.subject?.name) ?? "Class";
    const hh = String(Math.floor(e.start_minute / 60)).padStart(2, "0");
    const mm = String(e.start_minute % 60).padStart(2, "0");
    const location = e.location ? ` · ${e.location}` : "";
    // Only claim "starting soon" when that's still literally true — a run
    // that only caught this late (sparse cadence) says so honestly instead
    // of sending a "starting soon" push for a class already underway or over.
    const stillUpcoming = nowMinute < e.start_minute;
    const result = await sendPushToUser(e.user_id, {
      title: stillUpcoming ? `${subjectName} starting soon` : `${subjectName} today`,
      body: stillUpcoming
        ? `Starts at ${hh}:${mm}${location}`
        : `Scheduled ${hh}:${mm}${location} — missed the live reminder for this one.`,
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
