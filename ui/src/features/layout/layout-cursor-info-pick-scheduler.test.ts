import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CursorInfoPickScheduler } from 'src/features/layout/layout-cursor-info-pick-scheduler';

const INTERVAL_MS = 50;
const IDLE_FACTOR = 2;

describe('CursorInfoPickScheduler', () => {
  let pick: ReturnType<typeof vi.fn<() => void>>;
  let scheduler: CursorInfoPickScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    pick = vi.fn();
    scheduler = new CursorInfoPickScheduler({
      pick,
      intervalMs: INTERVAL_MS,
      idleFactor: IDLE_FACTOR,
    });
  });

  afterEach(() => {
    scheduler.cancel();
    vi.useRealTimers();
  });

  /** Simulates a pointer move event every `stepMs` for `durationMs`. */
  const moveFor = (durationMs: number, stepMs = 16): void => {
    for (let t = 0; t < durationMs; t += stepMs) {
      scheduler.schedule();
      vi.advanceTimersByTime(stepMs);
    }
  };

  it('picks immediately on the first move', () => {
    scheduler.schedule();
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it('picks at most once per interval while moving', () => {
    moveFor(1000);
    expect(pick.mock.calls.length).toBeGreaterThanOrEqual(18);
    expect(pick.mock.calls.length).toBeLessThanOrEqual(21);
  });

  it('always picks the final position after the cursor stops', () => {
    scheduler.schedule();
    vi.advanceTimersByTime(10);
    scheduler.schedule();
    expect(pick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(INTERVAL_MS);
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending pick', () => {
    scheduler.schedule();
    vi.advanceTimersByTime(10);
    scheduler.schedule();
    scheduler.cancel();

    vi.advanceTimersByTime(1000);
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it('starts the interval when a pick ends', () => {
    pick.mockImplementationOnce(() => {
      vi.advanceTimersByTime(10);
    });
    scheduler.schedule();
    scheduler.schedule();
    expect(pick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(INTERVAL_MS - 1);
    expect(pick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('extends the interval after slow picks', () => {
    const pickDurationMs = 500;
    pick.mockImplementationOnce(() => {
      vi.advanceTimersByTime(pickDurationMs);
    });
    scheduler.schedule();
    scheduler.schedule();

    vi.advanceTimersByTime(pickDurationMs * IDLE_FACTOR - 1);
    expect(pick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('picks immediately again after an idle period', () => {
    scheduler.schedule();
    vi.advanceTimersByTime(1000);
    scheduler.schedule();
    expect(pick).toHaveBeenCalledTimes(2);
  });
});
