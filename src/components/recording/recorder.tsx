"use client";

import * as React from "react";
import Link from "next/link";
import { Mic, Square, Pause, Play, Download, RefreshCw, HardDrive } from "lucide-react";
import {
  recorderReducer,
  initialRecorderContext,
} from "@/features/recording/state-machine";
import { uploadWithRetry } from "@/features/recording/upload";
import { drainChunkQueue, type DrainResult } from "@/features/recording/upload-queue";
import * as chunkDb from "@/features/recording/chunk-db";
import type { StoredSession } from "@/features/recording/chunk-db";
import { formatDuration } from "@/lib/utils/time";
import { Button } from "@/components/ui/button";

interface SubjectOption {
  id: string;
  name: string;
}

interface SessionMeta {
  subjectId: string;
  title: string;
  mimeType: string;
}

type FinalizeOutcome =
  | { ok: true; lectureId: string }
  | { ok: false; error: string };

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

/** Every chunk this session has produced is uploaded independently, in
 * order, with retry — this is what lets a 60-minute lecture survive a
 * Wi-Fi drop instead of losing everything on one giant final upload. */
async function drainSession(
  sessionId: string,
  subjectId: string,
  title: string,
  mimeType: string,
): Promise<DrainResult> {
  return drainChunkQueue(
    {
      getPendingChunks: () => chunkDb.getPendingChunks(sessionId),
      markUploaded: (index) => chunkDb.markChunkUploaded(sessionId, index),
    },
    {
      uploadChunk: async (chunk) => {
        const form = new FormData();
        form.append("index", String(chunk.index));
        form.append("chunk", chunk.blob, `chunk-${chunk.index}`);
        form.append("subject_id", subjectId);
        form.append("mime_type", mimeType);
        if (title.trim()) form.append("title", title.trim());
        const res = await fetch(`/api/recordings/sessions/${sessionId}/chunks`, {
          method: "POST",
          body: form,
        });
        if (res.status === 409) return; // already finalized elsewhere; nothing to do
        if (!res.ok) throw new Error(`Chunk upload failed (${res.status}).`);
      },
    },
    { isOnline: () => typeof navigator === "undefined" || navigator.onLine },
  );
}

export function Recorder({
  subjects,
  driveConnected,
}: {
  subjects: SubjectOption[];
  driveConnected: boolean;
}) {
  const [ctx, dispatch] = React.useReducer(
    recorderReducer,
    initialRecorderContext,
  );
  const [seconds, setSeconds] = React.useState(0);
  const [subjectId, setSubjectId] = React.useState(subjects[0]?.id ?? "");
  const [title, setTitle] = React.useState("");
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [needsDrive, setNeedsDrive] = React.useState(false);
  const [savedLectureId, setSavedLectureId] = React.useState<string | null>(null);
  const [fileExt, setFileExt] = React.useState("webm");

  const [recoverable, setRecoverable] = React.useState<StoredSession | null>(null);
  const [recovering, setRecovering] = React.useState(false);
  const [recoverError, setRecoverError] = React.useState<string | null>(null);
  const [recoverDoneId, setRecoverDoneId] = React.useState<string | null>(null);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const mimeRef = React.useRef<string>("");
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const secondsRef = React.useRef(0);

  const sessionIdRef = React.useRef<string | null>(null);
  const sessionMetaRef = React.useRef<SessionMeta | null>(null);
  const chunkIndexRef = React.useRef(0);
  const lastChunkSavedRef = React.useRef<Promise<void>>(Promise.resolve());
  const drainingRef = React.useRef(false);
  const drainAgainRef = React.useRef(false);
  const pendingRetryOnOnlineRef = React.useRef<(() => void) | null>(null);

  const cleanupMedia = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    timerRef.current = null;
    rafRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  React.useEffect(() => cleanupMedia, [cleanupMedia]);

  // Detect a recording left over from a refresh, crash, or closed tab — it's
  // still sitting safely in IndexedDB and just needs to finish uploading.
  React.useEffect(() => {
    let cancelled = false;
    chunkDb.getRecoverableSession().then((session) => {
      if (!cancelled && session) setRecoverable(session);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runDrainBackground = React.useCallback((sessionId: string) => {
    const meta = sessionMetaRef.current;
    if (!meta) return;
    if (drainingRef.current) {
      drainAgainRef.current = true;
      return;
    }
    drainingRef.current = true;
    void (async () => {
      let again = true;
      while (again) {
        again = false;
        await drainSession(sessionId, meta.subjectId, meta.title, meta.mimeType);
        if (drainAgainRef.current) {
          drainAgainRef.current = false;
          again = true;
        }
      }
    })().finally(() => {
      drainingRef.current = false;
    });
  }, []);

  React.useEffect(() => {
    function handleOnline() {
      if (sessionIdRef.current) runDrainBackground(sessionIdRef.current);
      const retry = pendingRetryOnOnlineRef.current;
      if (retry) {
        pendingRetryOnOnlineRef.current = null;
        retry();
      }
    }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [runDrainBackground]);

  // Flush whatever's been buffered since the last chunk boundary before the
  // tab is hidden/closed, so at most a few seconds of audio are ever at risk.
  React.useEffect(() => {
    function flush() {
      const recorder = recorderRef.current;
      if (recorder && recorder.state === "recording") {
        try {
          recorder.requestData();
        } catch {
          /* no-op: best-effort flush */
        }
      }
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const drawWaveform = React.useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      analyser.getByteTimeDomainData(buffer);
      const { width, height } = canvas;
      c.clearRect(0, 0, width, height);
      c.lineWidth = 2;
      c.strokeStyle = "hsl(243 75% 59%)";
      c.beginPath();
      const slice = width / buffer.length;
      let x = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
        x += slice;
      }
      c.lineTo(width, height / 2);
      c.stroke();
    };
    render();
  }, []);

  const startTimer = React.useCallback(() => {
    timerRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
  }, []);

  /** Upload every pending chunk, then assemble + save server-side. Never
   * resolves "ok" unless Drive actually has the file. */
  async function drainAndFinalize(params: {
    sessionId: string;
    subjectId: string;
    title: string;
    mimeType: string;
    elapsedSeconds: number;
    chunkCount: number;
  }): Promise<FinalizeOutcome> {
    if (!driveConnected) return { ok: false, error: "drive_not_connected" };

    const drain = await drainSession(
      params.sessionId,
      params.subjectId,
      params.title,
      params.mimeType,
    );
    if (!drain.ok) return { ok: false, error: drain.error ?? "upload_failed" };

    let lectureId: string | undefined;
    const result = await uploadWithRetry(async () => {
      const res = await fetch(`/api/recordings/sessions/${params.sessionId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationSeconds: params.elapsedSeconds,
          chunkCount: params.chunkCount,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        missing?: number[];
        lectureId?: string;
      };
      if (res.ok) {
        lectureId = data.lectureId;
        return;
      }
      if (data.error === "missing_chunks" && Array.isArray(data.missing)) {
        // Server is missing some bytes we thought we'd sent — requeue just
        // those and resume, rather than starting the whole upload over.
        for (const idx of data.missing) {
          await chunkDb.markChunkPending(params.sessionId, idx);
        }
        const redrain = await drainSession(
          params.sessionId,
          params.subjectId,
          params.title,
          params.mimeType,
        );
        if (!redrain.ok) throw new Error(redrain.error ?? "upload_failed");
        throw new Error("resuming_after_gap");
      }
      if (data.error === "drive_not_connected" || data.error === "reauth_required") {
        throw new Error("drive_not_connected");
      }
      throw new Error(data.error ?? `Save failed (${res.status}).`);
    });

    if (!result.ok || !lectureId) {
      return { ok: false, error: result.error ?? "upload_failed" };
    }
    await chunkDb.deleteSession(params.sessionId);
    return { ok: true, lectureId };
  }

  async function finishUpload(
    sessionId: string,
    subjectIdAtStart: string,
    titleAtStart: string,
    mimeType: string,
    elapsedSeconds: number,
    chunkCount: number,
  ) {
    dispatch({ type: "UPLOAD_START" });
    const outcome = await drainAndFinalize({
      sessionId,
      subjectId: subjectIdAtStart,
      title: titleAtStart,
      mimeType,
      elapsedSeconds,
      chunkCount,
    });

    if (outcome.ok) {
      pendingRetryOnOnlineRef.current = null;
      setSavedLectureId(outcome.lectureId);
      void fetch(`/api/recordings/${outcome.lectureId}/process`, { method: "POST" }).catch(
        () => {},
      );
      dispatch({ type: "UPLOAD_SUCCESS" });
      return;
    }

    if (outcome.error === "drive_not_connected") {
      setNeedsDrive(true);
      dispatch({ type: "UPLOAD_FAILURE", error: "drive_not_connected" });
      return;
    }

    if (outcome.error === "offline") {
      pendingRetryOnOnlineRef.current = () =>
        void finishUpload(sessionId, subjectIdAtStart, titleAtStart, mimeType, elapsedSeconds, chunkCount);
      dispatch({
        type: "UPLOAD_FAILURE",
        error: "You’re offline. Your recording is saved on this device — it’ll upload as soon as you’re back online.",
      });
      return;
    }

    dispatch({
      type: "UPLOAD_FAILURE",
      error: "Upload failed. Your recording is safe on this device — tap retry.",
    });
  }

  async function handleStart() {
    setNeedsDrive(false);
    setSavedLectureId(null);
    setAudioUrl(null);
    setRecoverDoneId(null);
    chunksRef.current = [];
    secondsRef.current = 0;
    setSeconds(0);
    chunkIndexRef.current = 0;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      dispatch({ type: "ERROR", error: "Recording isn’t supported in this browser." });
      return;
    }
    dispatch({ type: "REQUEST" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMimeType();
      mimeRef.current = mime;
      const ext = mime.includes("mp4") ? "m4a" : "webm";
      setFileExt(ext);

      const sessionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionIdRef.current = sessionId;
      const trimmedTitle = title.trim();
      sessionMetaRef.current = {
        subjectId,
        title: trimmedTitle,
        mimeType: mime || "audio/webm",
      };
      await chunkDb.createSession({
        id: sessionId,
        subjectId,
        title: trimmedTitle || null,
        mimeType: mime || "audio/webm",
        ext,
        status: "recording",
        elapsedSeconds: 0,
        chunkCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return;
        chunksRef.current.push(e.data);
        const index = chunkIndexRef.current++;
        lastChunkSavedRef.current = chunkDb
          .saveChunk(sessionId, index, e.data)
          .then(() => {
            void chunkDb.updateSessionProgress(
              sessionId,
              secondsRef.current,
              chunkIndexRef.current,
            );
            runDrainBackground(sessionId);
          });
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mime || "audio/webm",
        });
        setAudioUrl(URL.createObjectURL(blob));
        dispatch({ type: "STOPPED" });
        const totalChunks = chunkIndexRef.current;
        const meta = sessionMetaRef.current;
        const finalSeconds = secondsRef.current;
        void (async () => {
          await lastChunkSavedRef.current;
          await chunkDb.markSessionStopped(sessionId);
          if (meta) {
            await finishUpload(
              sessionId,
              meta.subjectId,
              meta.title,
              meta.mimeType,
              finalSeconds,
              totalChunks,
            );
          }
        })();
      };
      recorder.onerror = () => {
        dispatch({ type: "ERROR", error: "Recording failed unexpectedly." });
      };

      // Waveform visualizer.
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      // 10s chunks: frequent enough that a crash loses at most ~10s of
      // audio (less, given the visibility/pagehide flush above), coarse
      // enough not to flood the network with tiny requests.
      recorder.start(10000);
      dispatch({ type: "PERMISSION_GRANTED" });
      startTimer();
      drawWaveform();
    } catch (e) {
      const err = e as DOMException;
      const message =
        err?.name === "NotAllowedError"
          ? "Microphone permission was denied. Enable it in your browser settings."
          : err?.name === "NotFoundError"
            ? "No microphone was found."
            : "Couldn’t start recording.";
      dispatch({ type: "PERMISSION_DENIED", error: message });
      cleanupMedia();
    }
  }

  function handlePause() {
    recorderRef.current?.pause();
    if (timerRef.current) clearInterval(timerRef.current);
    dispatch({ type: "PAUSE" });
  }
  function handleResume() {
    recorderRef.current?.resume();
    startTimer();
    dispatch({ type: "RESUME" });
  }
  function handleStop() {
    dispatch({ type: "STOP" });
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }
  function handleRetry() {
    const sessionId = sessionIdRef.current;
    const meta = sessionMetaRef.current;
    if (!sessionId || !meta) return;
    void finishUpload(
      sessionId,
      meta.subjectId,
      meta.title,
      meta.mimeType,
      secondsRef.current,
      chunkIndexRef.current,
    );
  }
  function handleReset() {
    setAudioUrl(null);
    setSavedLectureId(null);
    setNeedsDrive(false);
    dispatch({ type: "RESET" });
  }

  async function handleRecoverFinish() {
    if (!recoverable) return;
    setRecovering(true);
    setRecoverError(null);
    const outcome = await drainAndFinalize({
      sessionId: recoverable.id,
      subjectId: recoverable.subjectId,
      title: recoverable.title ?? "",
      mimeType: recoverable.mimeType,
      elapsedSeconds: recoverable.elapsedSeconds,
      chunkCount: recoverable.chunkCount,
    });
    setRecovering(false);
    if (outcome.ok) {
      pendingRetryOnOnlineRef.current = null;
      setRecoverable(null);
      setRecoverDoneId(outcome.lectureId);
      void fetch(`/api/recordings/${outcome.lectureId}/process`, { method: "POST" }).catch(
        () => {},
      );
      return;
    }
    if (outcome.error === "drive_not_connected") {
      setRecoverError(
        "Connect Google Drive first, then try again — your recording is still safe on this device.",
      );
      return;
    }
    if (outcome.error === "offline") {
      pendingRetryOnOnlineRef.current = () => void handleRecoverFinish();
      setRecoverError("You’re offline. Reconnect and try again — nothing has been lost.");
      return;
    }
    setRecoverError(
      "Couldn’t finish uploading. Your recording is still safe on this device — try again.",
    );
  }

  async function handleRecoverDiscard() {
    if (!recoverable) return;
    await chunkDb.deleteSession(recoverable.id);
    setRecoverable(null);
    setRecoverError(null);
  }

  const { state, error } = ctx;
  const recording = state === "recording";
  const paused = state === "paused";
  const busy = state === "uploading" || state === "processing" || state === "stopping";
  const idle = state === "idle" || state === "error" || state === "completed";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {recoverable && idle ? (
        <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-medium">
            We found a recording from {new Date(recoverable.createdAt).toLocaleString()} (
            {formatDuration(recoverable.elapsedSeconds)}) that never finished uploading.
          </p>
          <p className="text-muted-foreground">
            Nothing was lost — it’s still saved on this device.
          </p>
          {recoverError ? <p className="text-destructive">{recoverError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleRecoverFinish} disabled={recovering}>
              {recovering ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Finishing…
                </>
              ) : (
                "Finish & save"
              )}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRecoverDiscard}
              disabled={recovering}
            >
              Discard
            </Button>
          </div>
        </div>
      ) : null}

      {recoverDoneId ? (
        <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          Recovered recording saved.{" "}
          <Link href="/lectures" className="font-medium text-primary hover:underline">
            View in lectures
          </Link>
        </div>
      ) : null}

      <div className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Subject</span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={recording || paused || busy}
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          >
            {subjects.length === 0 ? <option value="">No subjects yet</option> : null}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Title (optional)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={recording || paused || busy}
            placeholder="e.g. Week 4 — Neural Networks"
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <canvas
          ref={canvasRef}
          width={520}
          height={96}
          className="mx-auto mb-4 h-24 w-full max-w-lg rounded-lg bg-secondary/40"
        />
        <div className="mb-4 flex items-center justify-center gap-2 font-mono text-3xl tabular-nums">
          {(recording || paused) && (
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
          )}
          {formatDuration(seconds)}
        </div>

        <div className="flex items-center justify-center gap-3">
          {idle ? (
            <Button
              size="lg"
              onClick={handleStart}
              disabled={subjects.length === 0}
              className="rounded-full"
            >
              <Mic className="h-5 w-5" /> Start recording
            </Button>
          ) : null}

          {recording ? (
            <>
              <Button variant="secondary" size="lg" onClick={handlePause} className="rounded-full">
                <Pause className="h-5 w-5" /> Pause
              </Button>
              <Button variant="destructive" size="lg" onClick={handleStop} className="rounded-full">
                <Square className="h-5 w-5" /> Stop
              </Button>
            </>
          ) : null}

          {paused ? (
            <>
              <Button size="lg" onClick={handleResume} className="rounded-full">
                <Play className="h-5 w-5" /> Resume
              </Button>
              <Button variant="destructive" size="lg" onClick={handleStop} className="rounded-full">
                <Square className="h-5 w-5" /> Stop
              </Button>
            </>
          ) : null}

          {state === "requesting" ? (
            <p className="text-sm text-muted-foreground">Allow microphone access…</p>
          ) : null}
          {busy ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {state === "uploading" ? "Uploading…" : "Processing…"}
            </p>
          ) : null}
        </div>
      </div>

      {/* Status / recovery */}
      {state === "completed" ? (
        <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          Recording saved.{" "}
          {savedLectureId ? (
            <Link href="/lectures" className="font-medium text-primary hover:underline">
              View in lectures
            </Link>
          ) : null}
        </div>
      ) : null}

      {needsDrive ? (
        <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <HardDrive className="h-4 w-4" /> Connect Google Drive to save recordings
          </p>
          <p className="text-muted-foreground">
            Your recording was captured but not uploaded. Connect Drive, then retry —
            or download it now so nothing is lost.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings">
              <Button size="sm">Connect Drive</Button>
            </Link>
            {audioUrl ? (
              <a href={audioUrl} download={`kelo-recording.${fileExt}`}>
                <Button size="sm" variant="secondary">
                  <Download className="h-4 w-4" /> Download
                </Button>
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {state === "error" && !needsDrive ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <p className="text-destructive">{error}</p>
          <div className="flex flex-wrap gap-2">
            {audioUrl ? (
              <>
                <Button size="sm" onClick={handleRetry}>
                  <RefreshCw className="h-4 w-4" /> Retry upload
                </Button>
                <a href={audioUrl} download={`kelo-recording.${fileExt}`}>
                  <Button size="sm" variant="secondary">
                    <Download className="h-4 w-4" /> Download
                  </Button>
                </a>
              </>
            ) : (
              <Button size="sm" onClick={handleReset}>
                Try again
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
