"use client";

import * as React from "react";
import {
  createScheduleAction,
  updateScheduleAction,
} from "@/server/db/actions";
import { DAY_NAMES, minutesToHHMM } from "@/lib/utils/time";
import { Button } from "@/components/ui/button";

export interface SubjectOption {
  id: string;
  name: string;
  color: string;
}

export interface ClassFormValues {
  id?: string;
  subject_id: string;
  day_of_week: number;
  start: string; // HH:MM
  end: string; // HH:MM
  location: string;
}

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

export function ClassForm({
  subjects,
  initial,
  onDone,
}: {
  subjects: SubjectOption[];
  initial?: ClassFormValues;
  onDone: () => void;
}) {
  const isEdit = Boolean(initial?.id);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = isEdit
        ? await updateScheduleAction({}, formData)
        : await createScheduleAction({}, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setError(null);
        onDone();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4"
    >
      {isEdit ? <input type="hidden" name="id" value={initial?.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Subject</span>
          <select
            name="subject_id"
            defaultValue={initial?.subject_id ?? ""}
            required
            className={inputClass}
          >
            <option value="" disabled>
              Select…
            </option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Day</span>
          <select
            name="day_of_week"
            defaultValue={initial?.day_of_week ?? 1}
            className={inputClass}
          >
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Start</span>
          <input
            type="time"
            name="start"
            defaultValue={initial?.start ?? "10:00"}
            required
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">End</span>
          <input
            type="time"
            name="end"
            defaultValue={initial?.end ?? "11:00"}
            required
            className={inputClass}
          />
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Location (optional)</span>
        <input
          type="text"
          name="location"
          defaultValue={initial?.location ?? ""}
          placeholder="Room 204"
          className={inputClass}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Add class"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export { minutesToHHMM };
