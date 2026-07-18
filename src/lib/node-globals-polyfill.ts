// Some transitive dependencies (e.g. `commander`, pulled via `@solana/errors`)
// reference Node's CommonJS-only `__filename` / `__dirname` at module scope.
// The Cloudflare Workers (workerd) runtime that hosts our SSR + server
// functions doesn't define those globals, so any accidental import chain
// crashes with `ReferenceError: __filename is not defined` — the exact error
// reported when clicking "Verificar depósito e publicar".
//
// This shim defines safe empty values BEFORE any user code runs so that a
// Node-only package hitting them at import time doesn't take down the
// request. It is intentionally trivial and side-effect-only.

const g = globalThis as unknown as { __filename?: string; __dirname?: string };
if (typeof g.__filename === "undefined") g.__filename = "";
if (typeof g.__dirname === "undefined") g.__dirname = "";

export {};
