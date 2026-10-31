// Robust video seeking for frame sampling.
// A single 'seeked' event can legitimately never arrive (seek to the
// current time, slow range response), so callers must not treat one
// stalled seek as fatal — this helper only rejects when the video
// genuinely cannot display a frame.

export class SeekTimeout extends Error {
  constructor(t: number) {
    super(`seek to ${t.toFixed(1)}s timed out`);
    this.name = "SeekTimeout";
  }
}

export async function seekToVideo(v: HTMLVideoElement, t: number, timeoutMs = 15000): Promise<void> {
  const target = Math.max(0, t);
  // Already showing (approximately) this frame — no seek needed, and
  // browsers may not fire 'seeked' for a no-op seek.
  if (Math.abs(v.currentTime - target) < 0.03 && v.readyState >= 2) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new SeekTimeout(target));
    }, timeoutMs);
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("video error while seeking"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("error", onError);
    };
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("error", onError);
    try {
      v.currentTime = target;
    } catch (e) {
      cleanup();
      reject(e instanceof Error ? e : new Error("seek failed"));
    }
  });
}
