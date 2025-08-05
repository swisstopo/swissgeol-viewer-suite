export const run = <T>(action: () => T): T => action();

export const sleep = (millis: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, millis);
  });
