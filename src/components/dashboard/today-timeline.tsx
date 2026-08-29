"use client";

import * as React from "react";
import Link from "next/link";
import { Mic, Clock, MapPin } from "lucide-react";
import {
  classStatus,
  nextClassToday,
  type ClassStatus,
} from "@/features/timetable/overlap";
import { formatTime12 } from "@/lib/utils/time";
import { Button } from "@/components/ui/button";

export interface TimelineEntry {
  id: string;
  day_of_week: number;
  start_minute: number;
  end_minute: number;
  location: string | null;
  subject: { name: string; color: string } | null;
}

const STATUS_LABEL: Record<ClassStatus, string> = {
  upcoming: "Upcoming",
  starting_soon: "Starting soon",
  in_progress: "In progress",
  completed: "Done",
};

const STATUS_STYLE: Record<ClassStatus, string> = {
  upcoming: "text-muted-foreground",
  starting_soon: "text-warning",
  in_progress: "text-success",
  completed: "text-muted-foreground line-through",
};

function useNow() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function TodayTimeline({ entries }: { entries: TimelineEntry[] }) {
  const now = useNow();
  const day = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const todays = entries
    .filter((e) => e.day_of_week === day)
    .sort((a, b) => a.start_minute - b.start_minute);
  const next = nextClassToday(todays, nowMin);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-accent/30 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {next ? "Next class" : "No more classes today"}
        </p>
        {next ? (
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {next.subject?.name ?? "Class"}
              </h2>
              <p className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatTime12(next.start_minute)}
                </span>
                {next.location ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {next.location}
                  </span>
                ) : null}
              </p>
            </div>
            <Link href="/record">
              <Button size="lg">
                <Mic className="h-4 w-4" /> Record
              </Button>
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Enjoy the rest of your day.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Today</h3>
        {todays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing scheduled today.{" "}
            <Link href="/timetable" className="text-primary hover:underline">
              Edit timetable
            </Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {todays.map((e) => {
              const status = classStatus(e.start_minute, e.end_minute, nowMin);
              return (
                <li key={e.id} className="flex items-center gap-3">
                  <span
                    className="h-8 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: e.subject?.color ?? "#4f46e5" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {e.subject?.name ?? "Class"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime12(e.start_minute)} – {formatTime12(e.end_minute)}
                    </p>
                  </div>
                  <span className={`text-xs font-medium ${STATUS_STYLE[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
