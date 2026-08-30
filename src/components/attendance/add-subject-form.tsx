"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { createSubjectAction } from "@/server/db/actions";
import { Button } from "@/components/ui/button";

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

export function AddSubjectForm() {
  const [open, setOpen] = React.useState(false);
  const [color, setColor] = React.useState(PALETTE[0]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("color", color);
    startTransition(async () => {
      const res = await createSubjectAction({}, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setError(null);
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add subject
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full space-y-3 rounded-xl border border-border bg-secondary/40 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Name</span>
          <input name="name" required placeholder="Data Science" className={inputClass} />
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
        <label className="space-y-1 text-sm">
          <span className="font-medium">Year (optional)</span>
          <input name="year" type="number" placeholder="2026" className={inputClass} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Semester (optional)</span>
          <input name="semester" placeholder="Semester 1" className={inputClass} />
        </label>
      </div>
      <div className="space-y-1.5">
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
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add subject"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
