// @solana/web3.js and @solana/spl-token assume Node's global `Buffer` is
// available (Webpack/CRA polyfill it automatically; Vite does not). Without
// this, browser calls like `new PublicKey(...)` or `Connection.getParsedAccountInfo`
// fail with "Cannot read properties of undefined (reading 'from')" the first
// time internal code does `Buffer.from(...)`.
//
// Call this once, client-side only, before touching any Solana SDK code.
let installed = false;

export async function ensureSolanaBufferPolyfill(): Promise<void> {
  if (installed || typeof window === "undefined") return;
  const w = window as unknown as { Buffer?: unknown };
  if (!w.Buffer) {
    const { Buffer } = await import("buffer");
    w.Buffer = Buffer;
  }
  installed = true;
}
