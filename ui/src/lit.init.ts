// Suppress dev mode warning.
if (process.env.NODE_ENV === 'development') {
  globalThis.litIssuedWarnings ??= new Set();
  globalThis.litIssuedWarnings.add(
    'Lit is in dev mode. Not recommended for production! See https://lit.dev/msg/dev-mode for more information.',
  );
}
