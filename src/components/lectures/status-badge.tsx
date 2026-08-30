import type { LectureStatus } from "@/lib/supabase/types";

const CONFIG: Record<LectureStatus, { label: string; className: string }> = {
  recording: { label: "Recording", className: "bg-destructive/15 text-destructive" },
  uploading: { label: "Uploading", className: "bg-warning/15 text-warning" },
  uploaded: { label: "Uploaded", className: "bg-warning/15 text-warning" },
  transcribing: { label: "Transcribing", className: "bg-primary/15 text-primary" },
  transcribed: { label: "Transcribed", className: "bg-primary/15 text-primary" },
  analyzing: { label: "Analyzing", className: "bg-primary/15 text-primary" },
  finalizing: { label: "Finalizing", className: "bg-primary/15 text-primary" },
  completed: { label: "Completed", className: "bg-success/15 text-success" },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive" },
  recoverable: { label: "Needs retry", className: "bg-destructive/15 text-destructive" },
};

export function StatusBadge({ status }: { status: LectureStatus }) {
  const c = CONFIG[status] ?? CONFIG.uploaded;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${c.className}`}
    >
      {c.label}
    </span>
  );
}
