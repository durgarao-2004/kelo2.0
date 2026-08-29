"use client";

import * as React from "react";
import { Trash2, Check, X, Ban } from "lucide-react";
import {
  markAttendanceAction,
  deleteSubjectAction,
} from "@/server/db/actions";
import { Button } from "@/components/ui/button";
import { AttendanceRing } from "./attendance-ring";
import type { AttendanceStats } from "@/features/attendance/calc";

export interface SubjectAttendanceVM {
  subjectId: string;
  name: string;
  color: string;
  stats: AttendanceStats;
}

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local tz
}

function statusLine(stats: AttendanceStats): string {
  if (stats.status === "no_data") return "No classes recorded yet.";
  if (stats.status === "safe") {
    if (stats.safeSkips === null) return "On track.";
    if (stats.safeSkips === 0) return "Right at the limit — don’t miss the next one.";
    return `You can still skip ${stats.safeSkips} class${stats.safeSkips === 1 ? "" : "es"}.`;
  }
  if (stats.classesToTarget === null) {
    return `Can’t reach ${stats.requiredPercent}% this term.`;
  }
  return `Attend ${stats.classesToTarget} more to reach ${stats.requiredPercent}%.`;
}

function MarkButton({
  subjectId,
  status,
  children,
  className,
}: {
  subjectId: string;
  status: "attended" | "missed" | "cancelled";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form action={markAttendanceAction}>
      <input type="hidden" name="subject_id" value={subjectId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="occurred_on" value={todayLocal()} />
      <button
        type="submit"
        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition hover:bg-secondary ${className ?? ""}`}
      >
        {children}
      </button>
    </form>
  );
}

function DeleteSubject({ subjectId, name }: { subjectId: string; name: string }) {
  return (
    <form
      action={deleteSubjectAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete “${name}”? This removes its classes and attendance.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={subjectId} />
      <Button variant="ghost" size="sm" type="submit" aria-label="Delete subject">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </form>
  );
}

export function SubjectList({ items }: { items: SubjectAttendanceVM[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
        Add your subjects to start tracking attendance.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.subjectId}
          className="animate-fade-in rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-start gap-4">
            <AttendanceRing
              percentage={item.stats.percentage}
              status={item.stats.status}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <h3 className="truncate font-medium">{item.name}</h3>
                </div>
                <DeleteSubject subjectId={item.subjectId} name={item.name} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.stats.attended}/{item.stats.conducted} attended · required{" "}
                {item.stats.requiredPercent}%
              </p>
              <p
                className={`mt-1 text-xs font-medium ${
                  item.stats.status === "warning"
                    ? "text-warning"
                    : item.stats.status === "safe"
                      ? "text-success"
                      : "text-muted-foreground"
                }`}
              >
                {statusLine(item.stats)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <MarkButton subjectId={item.subjectId} status="attended">
              <Check className="h-3.5 w-3.5 text-success" /> Present
            </MarkButton>
            <MarkButton subjectId={item.subjectId} status="missed">
              <X className="h-3.5 w-3.5 text-destructive" /> Absent
            </MarkButton>
            <MarkButton subjectId={item.subjectId} status="cancelled">
              <Ban className="h-3.5 w-3.5 text-muted-foreground" /> Cancelled
            </MarkButton>
          </div>
        </div>
      ))}
    </div>
  );
}
