"use client";

import { motion } from "framer-motion";
import { Mic, Clock } from "lucide-react";

/** Subtle floating product preview — premium, restrained, no heavy 3D. */
export function HeroPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative mx-auto w-full max-w-md"
      style={{ perspective: 1000 }}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-2xl border border-border bg-card/80 p-5 shadow-2xl backdrop-blur"
      >
        <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/40 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Next class
          </p>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <p className="text-lg font-semibold">Data Science</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> 10:00 AM
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
              <Mic className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Attendance</span>
            <span className="font-medium text-success">82% · Safe</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-success"
              initial={{ width: 0 }}
              animate={{ width: "82%" }}
              transition={{ duration: 1.1, delay: 0.4, ease: "easeOut" }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2">
            {["Recording", "Transcript", "Summary"].map((t) => (
              <div
                key={t}
                className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-center text-[11px] text-muted-foreground"
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
