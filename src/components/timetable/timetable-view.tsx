"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Clock, MapPin } from "lucide-react";
import { deleteScheduleAction } from "@/server/db/actions";
import { DAY_NAMES, formatTime12, minutesToHHMM } from "@/lib/utils/time";
import { Button } from "@/components/ui/button";
import { ClassForm, type SubjectOption } from "./class-form";

export interface ScheduleItem {
  id: string;
  subject_id: string;
  day_of_week: number;
  start_minute: number;
  end_minute: number;
  location: string | null;
  subject: { id: string; name: string; color: string } | null;
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function TimetableView({
  subjects,
  entries,
}: {
  subjects: SubjectOption[];
  entries: ScheduleItem[];
}) {
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const byDay = new Map<number, ScheduleItem[]>();
  for (const e of entries) {
    const list = byDay.get(e.day_of_week) ?? [];
    list.push(e);
    byDay.set(e.day_of_week, list);
  }

  if (subjects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-muted-foreground">
          Add a subject first, then build your weekly timetable.
        </p>
        <Link href="/attendance" className="mt-3 inline-block">
          <Button size="sm">Add a subject</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {!adding ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add class
          </Button>
        ) : null}
      </div>

      {adding ? (
        <ClassForm subjects={subjects} onDone={() => setAdding(false)} />
      ) : null}

      {entries.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">
          No classes yet. Add your first class to get started.
        </p>
      ) : null}

      <div className="space-y-6">
        {DAY_ORDER.filter((d) => byDay.has(d)).map((day) => (
          <section key={day}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              {DAY_NAMES[day]}
            </h2>
            <ul className="space-y-2">
              {byDay
                .get(day)!
                .sort((a, b) => a.start_minute - b.start_minute)
                .map((e) =>
                  editingId === e.id ? (
                    <li key={e.id}>
                      <ClassForm
                        subjects={subjects}
                        initial={{
                          id: e.id,
                          subject_id: e.subject_id,
                          day_of_week: e.day_of_week,
                          start: minutesToHHMM(e.start_minute),
                          end: minutesToHHMM(e.end_minute),
                          location: e.location ?? "",
                        }}
                        onDone={() => setEditingId(null)}
                      />
                    </li>
                  ) : (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <span
                        className="h-9 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: e.subject?.color ?? "#4f46e5" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {e.subject?.name ?? "Unknown subject"}
                        </p>
                        <p className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime12(e.start_minute)} –{" "}
                            {formatTime12(e.end_minute)}
                          </span>
                          {e.location ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {e.location}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Edit"
                        onClick={() => setEditingId(e.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <form action={deleteScheduleAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <Button
                          variant="ghost"
                          size="sm"
                          type="submit"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </form>
                    </li>
                  ),
                )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
