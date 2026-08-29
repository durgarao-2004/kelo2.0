import { describe, it, expect } from "vitest";
import {
  recorderReducer,
  initialRecorderContext,
  canStart,
  isActive,
  isBusy,
  type RecorderContext,
  type RecorderEvent,
} from "./state-machine";
import { uploadWithRetry } from "./upload";

function run(events: RecorderEvent[], start = initialRecorderContext) {
  return events.reduce<RecorderContext>(
    (ctx, e) => recorderReducer(ctx, e),
    start,
  );
}

describe("recorderReducer", () => {
  it("runs the happy path idle → completed", () => {
    const ctx = run([
      { type: "REQUEST" },
      { type: "PERMISSION_GRANTED" },
      { type: "STOP" },
      { type: "STOPPED" },
      { type: "UPLOAD_START" },
      { type: "UPLOAD_SUCCESS" },
    ]);
    expect(ctx.state).toBe("completed");
    expect(ctx.hasUnsavedAudio).toBe(false);
    expect(ctx.error).toBeNull();
  });

  it("handles permission denial", () => {
    const ctx = run([
      { type: "REQUEST" },
      { type: "PERMISSION_DENIED", error: "Microphone blocked" },
    ]);
    expect(ctx.state).toBe("error");
    expect(ctx.error).toBe("Microphone blocked");
  });

  it("supports pause and resume", () => {
    const ctx = run([
      { type: "REQUEST" },
      { type: "PERMISSION_GRANTED" },
      { type: "PAUSE" },
      { type: "RESUME" },
    ]);
    expect(ctx.state).toBe("recording");
  });

  it("ignores invalid transitions", () => {
    // Can't pause before recording.
    expect(recorderReducer(initialRecorderContext, { type: "PAUSE" }).state).toBe(
      "idle",
    );
    // Can't upload-success without uploading.
    const processing = run([
      { type: "REQUEST" },
      { type: "PERMISSION_GRANTED" },
      { type: "STOP" },
      { type: "STOPPED" },
    ]);
    expect(processing.state).toBe("processing");
    expect(recorderReducer(processing, { type: "UPLOAD_SUCCESS" }).state).toBe(
      "processing",
    );
  });

  it("keeps audio recoverable after an upload failure and allows retry", () => {
    const failed = run([
      { type: "REQUEST" },
      { type: "PERMISSION_GRANTED" },
      { type: "STOP" },
      { type: "STOPPED" },
      { type: "UPLOAD_START" },
      { type: "UPLOAD_FAILURE", error: "Network error" },
    ]);
    expect(failed.state).toBe("error");
    expect(failed.hasUnsavedAudio).toBe(true);
    // Retry from the error state.
    const retried = run(
      [{ type: "UPLOAD_START" }, { type: "UPLOAD_SUCCESS" }],
      failed,
    );
    expect(retried.state).toBe("completed");
    expect(retried.hasUnsavedAudio).toBe(false);
  });

  it("RESET returns to initial", () => {
    const ctx = run([{ type: "ERROR", error: "boom" }, { type: "RESET" }]);
    expect(ctx).toEqual(initialRecorderContext);
  });

  it("guards expose sensible booleans", () => {
    expect(canStart("idle")).toBe(true);
    expect(canStart("recording")).toBe(false);
    expect(isActive("paused")).toBe(true);
    expect(isBusy("uploading")).toBe(true);
    expect(isBusy("recording")).toBe(false);
  });
});

describe("uploadWithRetry", () => {
  const noSleep = () => Promise.resolve();

  it("succeeds on the first try", async () => {
    let calls = 0;
    const res = await uploadWithRetry(
      async () => {
        calls++;
      },
      { sleep: noSleep },
    );
    expect(res.ok).toBe(true);
    expect(res.attempts).toBe(1);
    expect(calls).toBe(1);
  });

  it("retries then succeeds", async () => {
    let calls = 0;
    const res = await uploadWithRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error("flaky");
      },
      { retries: 3, sleep: noSleep },
    );
    expect(res.ok).toBe(true);
    expect(res.attempts).toBe(3);
  });

  it("gives up after exhausting retries and reports the error", async () => {
    let calls = 0;
    const res = await uploadWithRetry(
      async () => {
        calls++;
        throw new Error("still down");
      },
      { retries: 2, sleep: noSleep },
    );
    expect(res.ok).toBe(false);
    expect(res.attempts).toBe(3); // first + 2 retries
    expect(res.error).toBe("still down");
    expect(calls).toBe(3);
  });
});
