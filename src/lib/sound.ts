/**
 * Synthesized notification chime for staff screens, built on the Web Audio API.
 *
 * No bundled audio file and no runtime fetch/CDN: the tone is generated from
 * oscillators, so it works fully offline on the Pi (AGENTS.md §11). Client-only —
 * every entry point guards against a missing `window`/`AudioContext`.
 */

type WindowWithAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

/** Two-note chime: frequency (Hz) and start offset (seconds) per note. */
const CHIME_NOTES: ReadonlyArray<{ frequency: number; offset: number }> = [
  { frequency: 880, offset: 0 },
  { frequency: 1174.66, offset: 0.14 },
];
const NOTE_DURATION = 0.22;
const PEAK_GAIN = 0.18;

let context: AudioContext | null = null;

/** Lazily create (or reuse) the shared AudioContext. Returns null when unsupported. */
function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctor =
    window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

/**
 * Resume the AudioContext from within a user gesture so later playback is allowed
 * despite browser autoplay policies. Safe to call repeatedly.
 */
export function unlockAudio(): void {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
}

/** Play the short "new order" chime. No-op (silently) when audio is unavailable. */
export function playNewOrderChime(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  for (const { frequency, offset } of CHIME_NOTES) {
    const startAt = now + offset;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    // Soft attack/decay envelope so the tone is pleasant, not a harsh beep.
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + NOTE_DURATION);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + NOTE_DURATION);
  }
}
