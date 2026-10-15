export interface CursorInfoPickSchedulerOptions {
  /**
   * Picks the scene at the latest cursor position.
   */
  pick: () => void;

  /**
   * The minimal time between the end of a pick and the start of the next one, in milliseconds.
   */
  intervalMs: number;

  /**
   * Extends the time between picks to this multiple of the last pick's duration,
   * if that is longer than {@link intervalMs}.
   * This bounds the share of time spent picking to `1 / (1 + factor)`.
   */
  idleFactor: number;
}

/**
 * Limits how often the cursor info picks the scene while the cursor moves.
 *
 * Each pick forces a synchronous GPU read-back (and the position pick re-renders depth),
 * so picking on every pointer move costs a considerable part of each frame.
 *
 * Picks are throttled (leading and trailing), so the final cursor position is always picked.
 * The interval starts when a pick ends and grows with the pick's duration,
 * so the render loop keeps most of the time even when picks are slow
 * (e.g. while many tiles are loading).
 */
export class CursorInfoPickScheduler {
  private nextPickTime = Number.NEGATIVE_INFINITY;

  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: CursorInfoPickSchedulerOptions) {}

  /**
   * Requests a pick at the current cursor position.
   * The pick callback is expected to read the latest cursor position when it runs.
   */
  schedule(): void {
    if (this.timeout !== null) {
      return;
    }
    const wait = this.nextPickTime - performance.now();
    if (wait <= 0) {
      this.runPick();
      return;
    }
    this.timeout = setTimeout(() => {
      this.timeout = null;
      this.runPick();
    }, wait);
  }

  /**
   * Cancels a pending pick.
   */
  cancel(): void {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private runPick(): void {
    const start = performance.now();
    try {
      this.options.pick();
    } finally {
      const end = performance.now();
      this.nextPickTime =
        end +
        Math.max(
          this.options.intervalMs,
          (end - start) * this.options.idleFactor,
        );
    }
  }
}
