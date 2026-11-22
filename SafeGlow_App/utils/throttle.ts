export function throttle<Args extends unknown[]>(fn: (...args: Args) => void, waitMs: number) {
  let lastCall = 0;
  let trailingTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;

  const invoke = (args: Args) => {
    lastCall = Date.now();
    fn(...args);
  };

  return (...args: Args) => {
    const remaining = waitMs - (Date.now() - lastCall);
    if (remaining <= 0) {
      if (trailingTimer !== null) {
        clearTimeout(trailingTimer);
        trailingTimer = null;
      }
      pendingArgs = null;
      invoke(args);
      return;
    }

    pendingArgs = args;
    if (trailingTimer === null) {
      trailingTimer = setTimeout(() => {
        trailingTimer = null;
        if (pendingArgs) {
          const next = pendingArgs;
          pendingArgs = null;
          invoke(next);
        }
      }, remaining);
    }
  };
}
