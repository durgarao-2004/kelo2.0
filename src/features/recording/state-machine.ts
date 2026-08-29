/**
 * Recorder lifecycle as a pure reducer — fully unit-testable, no browser APIs.
 * The React component drives real MediaRecorder/getUserMedia and dispatches
 * these events; the reducer owns the valid transitions.
 */
export type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "stopping"
  | "processing"
  | "uploading"
  | "completed"
  | "error";

export type RecorderEvent =
  | { type: "REQUEST" }
  | { type: "PERMISSION_GRANTED" }
  | { type: "PERMISSION_DENIED"; error: string }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP" }
  | { type: "STOPPED" }
  | { type: "UPLOAD_START" }
  | { type: "UPLOAD_SUCCESS" }
  | { type: "UPLOAD_FAILURE"; error: string }
  | { type: "ERROR"; error: string }
  | { type: "RESET" };

export interface RecorderContext {
  state: RecorderState;
  error: string | null;
  /** True once recording has produced audio that isn't safely uploaded yet. */
  hasUnsavedAudio: boolean;
}

export const initialRecorderContext: RecorderContext = {
  state: "idle",
  error: null,
  hasUnsavedAudio: false,
};

export function recorderReducer(
  ctx: RecorderContext,
  event: RecorderEvent,
): RecorderContext {
  switch (event.type) {
    case "REQUEST":
      if (ctx.state !== "idle" && ctx.state !== "error") return ctx;
      return { state: "requesting", error: null, hasUnsavedAudio: false };

    case "PERMISSION_GRANTED":
      if (ctx.state !== "requesting") return ctx;
      return { ...ctx, state: "recording", error: null };

    case "PERMISSION_DENIED":
      if (ctx.state !== "requesting") return ctx;
      return { ...ctx, state: "error", error: event.error };

    case "PAUSE":
      if (ctx.state !== "recording") return ctx;
      return { ...ctx, state: "paused" };

    case "RESUME":
      if (ctx.state !== "paused") return ctx;
      return { ...ctx, state: "recording" };

    case "STOP":
      if (ctx.state !== "recording" && ctx.state !== "paused") return ctx;
      return { ...ctx, state: "stopping" };

    case "STOPPED":
      if (ctx.state !== "stopping") return ctx;
      return { ...ctx, state: "processing", hasUnsavedAudio: true };

    case "UPLOAD_START":
      if (ctx.state !== "processing" && ctx.state !== "error") return ctx;
      return { ...ctx, state: "uploading", error: null };

    case "UPLOAD_SUCCESS":
      if (ctx.state !== "uploading") return ctx;
      return { ...ctx, state: "completed", error: null, hasUnsavedAudio: false };

    case "UPLOAD_FAILURE":
      if (ctx.state !== "uploading") return ctx;
      // Stays recoverable: audio is still held so the user can retry/download.
      return { ...ctx, state: "error", error: event.error, hasUnsavedAudio: true };

    case "ERROR":
      return { ...ctx, state: "error", error: event.error };

    case "RESET":
      return { ...initialRecorderContext };

    default:
      return ctx;
  }
}

export function canStart(state: RecorderState): boolean {
  return state === "idle" || state === "error";
}
export function isActive(state: RecorderState): boolean {
  return state === "recording" || state === "paused";
}
export function isBusy(state: RecorderState): boolean {
  return (
    state === "requesting" ||
    state === "stopping" ||
    state === "processing" ||
    state === "uploading"
  );
}
