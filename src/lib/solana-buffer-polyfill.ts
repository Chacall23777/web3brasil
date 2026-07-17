// @solana/web3.js and @solana/spl-token assume Node's global `Buffer` is
// available (Webpack/CRA polyfill it automatically; Vite does not). Without
// this, browser calls like `new PublicKey(...)` or `Connection.getParsedAccountInfo`
// fail with "Buffer is not defined" / "Cannot read properties of undefined
// (reading 'from')" the first time internal code does `Buffer.from(...)`.
//
// Importing this module for side effects kicks off the install immediately in
// the browser; `ensureSolanaBufferPolyfill()` awaits completion for callers
// that need a hard guarantee before touching the Solana SDKs.

let installPromise: Promise<void> | null = null;

function install(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as unknown as { Buffer?: unknown; global?: unknown; process?: unknown };
  if (w.Buffer) return Promise.resolve();
  return import("buffer").then(({ Buffer }) => {
    w.Buffer = Buffer;
    if (!w.global) w.global = window;
    if (!w.process) w.process = { env: {} };
  });
}

export function ensureSolanaBufferPolyfill(): Promise<void> {
  if (!installPromise) installPromise = install();
  return installPromise;
}

// Side-effect: start installing as soon as this module is imported.
ensureSolanaBufferPolyfill();
