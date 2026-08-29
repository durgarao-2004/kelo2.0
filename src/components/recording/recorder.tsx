"use client";

import * as React from "react";
import Link from "next/link";
import { Mic, Square, Pause, Play, Download, RefreshCw, HardDrive } from "lucide-react";
import {
  recorderReducer,
  initialRecorderContext,
} from "@/features/recording/state-machine";
import { uploadWithRetry } from "@/features/recording/upload";
import { formatDuration } from "@/lib/utils/time";
import { Button } from "@/components/ui/button";

interface SubjectOption {
  id: string;
  name: string;
}

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

  async function doUpload(blob: Blob) {
    if (!driveConnected) {
      setNeedsDrive(true);
      dispatch({ type: "UPLOAD_FAILURE", error: "drive_not_connected" });
      return;
    }
    dispatch({ type: "UPLOAD_START" });
    const form = new FormData();
    const ext = mimeRef.current.includes("mp4") ? "m4a" : "webm";
    form.append("audio", blob, `recording.${ext}`);
    form.append("subject_id", subjectId);
    form.append("duration_seconds", String(secondsRef.current));
    if (title.trim()) form.append("title", title.trim());

    const result = await uploadWithRetry(async () => {
      const res = await fetch("/api/recordings/upload", {
        method: "POST",
        body: form,
      });
      if (res.status === 409) {
        setNeedsDrive(true);
        throw Object.assign(new Error("drive_not_connected"), { fatal: true });
      }
      if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
      const data = (await res.json()) as { lectureId?: string };
      if (data.lectureId) {
        setSavedLectureId(data.lectureId);
        // Kick off transcription/analysis in the background (safe to retry later).
        void fetch(`/api/recordings/${data.lectureId}/process`, {
          method: "POST",
        }).catch(() => {});
      }
    });

    if (result.ok) {
      dispatch({ type: "UPLOAD_SUCCESS" });
    } else {
      dispatch({ type: "UPLOAD_FAILURE", error: result.error ?? "Upload failed." });
    }
  }

  async function handleStart() {
    setNeedsDrive(false);
    setSavedLectureId(null);
    setAudioUrl(null);
    chunksRef.current = [];
    secondsRef.current = 0;
    setSeconds(0);

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
      setFileExt(mime.includes("mp4") ? "m4a" : "webm");
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mime || "audio/webm",
        });
        setAudioUrl(URL.createObjectURL(blob));
        dispatch({ type: "STOPPED" });
        void doUpload(blob);
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

      recorder.start(1000);
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
    if (!audioUrl) return;
    fetch(audioUrl)
      .then((r) => r.blob())
      .then((blob) => doUpload(blob));
  }
  function handleReset() {
    setAudioUrl(null);
    setSavedLectureId(null);
    setNeedsDrive(false);
    dispatch({ type: "RESET" });
  }

  const { state, error } = ctx;
  const recording = state === "recording";
  const paused = state === "paused";
  const busy = state === "uploading" || state === "processing" || state === "stopping";

  return (
    <div className="mx-auto max-w-xl space-y-6">
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
          {state === "idle" || state === "error" || state === "completed" ? (
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
                <a href={audioUrl} download="kelo-recording.webm">
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
