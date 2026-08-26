"use client";

import Image from "next/image";
import { motion } from "motion/react";

import { terminalMessages as t } from "@/lib/messages";

/** Idle attract/standby screen. Tapping anywhere starts an order. */
export function WelcomeScreen({
  cafeName,
  onStart,
}: {
  cafeName: string;
  onStart: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onStart}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex h-dvh w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-stone-900 via-amber-950 to-stone-900 px-8 text-center"
    >
      {/* Ambient floating glow */}
      <motion.div
        aria-hidden
        className="absolute -top-32 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl"
        animate={{ y: [0, 40, 0], x: [0, 20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-orange-600/20 blur-3xl"
        animate={{ y: [0, -30, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.6 }}
        className="relative z-10 flex flex-col items-center gap-8"
      >
        <Image
          src="/brand/logo-weiss.png"
          alt={cafeName}
          width={320}
          height={180}
          priority
          className="h-auto w-64 opacity-95"
        />
        <p className="text-xl font-light tracking-wide text-amber-100/80">{t.welcome.tagline}</p>

        <motion.span
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="mt-4 rounded-full bg-amber-500 px-12 py-6 text-2xl font-semibold text-stone-900 shadow-2xl shadow-amber-900/40"
        >
          {t.welcome.cta}
        </motion.span>
        <p className="text-sm uppercase tracking-widest text-amber-100/75">{t.welcome.hint}</p>
      </motion.div>
    </motion.button>
  );
}
