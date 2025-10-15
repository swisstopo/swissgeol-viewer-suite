export const run = <T>(action: () => T): T => action();

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait?: number,
  isImmediate = false,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return function executedFunction(this: any, ...args: any[]): void {
    const later = () => {
      timeout = undefined;
      if (!isImmediate) func.apply(this, args);
    };

    const shouldCallNow = isImmediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (shouldCallNow) {
      func.apply(this, args);
    }
  };
}

export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  wait?: number,
): (...args: Parameters<T>) => void {
  let lastArgs: Parameters<T> | null = null;
  let isThrottling = false;

  return (...args: Parameters<T>) => {
    if (!isThrottling) {
      fn(...args);
      isThrottling = true;
      setTimeout(() => {
        isThrottling = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, wait);
    } else {
      lastArgs = args;
    }
  };
}
