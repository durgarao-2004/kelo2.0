"use client";

import * as React from "react";
import {
  createClassAction,
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

const NEW_SUBJECT = "__new__";

const PALETTE = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

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
  const [subjectChoice, setSubjectChoice] = React.useState(
    initial?.subject_id ?? (subjects.length === 0 ? NEW_SUBJECT : ""),
  );
  const [color, setColor] = React.useState(PALETTE[0]);
  const isNewSubject = !isEdit && subjectChoice === NEW_SUBJECT;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (isNewSubject) formData.set("color", color);
    startTransition(async () => {
      const res = isEdit
        ? await updateScheduleAction({}, formData)
        : await createClassAction({}, formData);
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
      {!isEdit ? (
        <input type="hidden" name="subject_mode" value={isNewSubject ? "new" : "existing"} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Subject</span>
          <select
            name="subject_id"
            value={subjectChoice}
            onChange={(e) => setSubjectChoice(e.target.value)}
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
            {!isEdit ? <option value={NEW_SUBJECT}>+ New subject…</option> : null}
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

      {isNewSubject ? (
        <div className="grid gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">New subject name</span>
            <input
              name="new_subject_name"
              required
              placeholder="Financial Management"
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Required attendance %</span>
            <input
              name="target_attendance"
              type="number"
              min={0}
              max={100}
              defaultValue={75}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Total sessions this term</span>
            <input
              name="total_sessions"
              type="number"
              min={1}
              defaultValue={33}
              className={inputClass}
            />
          </label>
          <div className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Color</span>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full ring-offset-2 ring-offset-background transition"
                  style={{
                    backgroundColor: c,
                    boxShadow: color === c ? `0 0 0 2px hsl(var(--ring))` : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

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
