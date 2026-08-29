"use client";

import { motion } from "framer-motion";

/**
 * Subtle, premium ambient background — two slow-drifting blurred gradient
 * orbs. Deliberately restrained (no childish 3D). Honors reduced-motion via
 * the global CSS rule that neutralizes animations.
 */
export function AuthBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 -right-24 h-[26rem] w-[26rem] rounded-full bg-accent/50 blur-3xl"
        animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,transparent,hsl(var(--background)))]" />
    </div>
  );
}
