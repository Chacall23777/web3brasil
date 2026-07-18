// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ARQUIVO:  vite.config.ts
// REPO:     https://github.com/Chacall23777/web3brasil
// CAMINHO:  /vite.config.ts  (raiz do projeto — substitui o original)
//
// CORREÇÕES APLICADAS:
//   ✅ Adicionado `define` com __filename, __dirname, global, process.env
//      → elimina ReferenceError: __filename is not defined no browser
//   ✅ Adicionado alias de Buffer (browser-safe para @solana/web3.js)
//   ✅ Adicionado `ssr.noExternal` para forçar bundle SSR dos pacotes Solana
//      → impede que o TanStack Start deixe CJS Solana vazar para o cliente
//   ✅ Mantida TODA a configuração original (solanaAliases, PWA, mcpPlugin)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
// - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
// componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
// error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

// ── Resolução de .mjs browser para pacotes Solana (mantida do original) ────
const resolveBrowserMjs = (pkg: string, relPath: string) =>
  fileURLToPath(new URL(`./node_modules/${pkg}/${relPath}`, import.meta.url));

const rpcWsBrowser = resolveBrowserMjs(
  "rpc-websockets",
  "dist/index.browser.mjs"
);

const solanaAliases = [
  {
    find: /^@solana\/codecs$/,
    replacement: resolveBrowserMjs(
      "@solana/codecs",
      "dist/index.browser.mjs"
    ),
  },
  {
    find: /^@solana\/codecs-core$/,
    replacement: resolveBrowserMjs(
      "@solana/codecs-core",
      "dist/index.browser.mjs"
    ),
  },
  {
    find: /^@solana\/codecs-numbers$/,
    replacement: resolveBrowserMjs(
      "@solana/codecs-numbers",
      "dist/index.browser.mjs"
    ),
  },
  {
    find: /^@solana\/codecs-strings$/,
    replacement: resolveBrowserMjs(
      "@solana/codecs-strings",
      "dist/index.browser.mjs"
    ),
  },
  {
    find: /^@solana\/codecs-data-structures$/,
    replacement: resolveBrowserMjs(
      "@solana/codecs-data-structures",
      "dist/index.browser.mjs"
    ),
  },
  {
    find: /^@solana\/options$/,
    replacement: resolveBrowserMjs(
      "@solana/options",
      "dist/index.browser.mjs"
    ),
  },
  {
    find: /^@solana\/errors$/,
    replacement: resolveBrowserMjs(
      "@solana/errors",
      "dist/index.browser.mjs"
    ),
  },
];

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },

  vite: {
    // ── CORREÇÃO PRINCIPAL ─────────────────────────────────────────────────
    // __filename e __dirname são variáveis globais do Node.js que NÃO existem
    // no browser. O @solana/web3.js (CJS) e @solana/spl-token as referenciam
    // internamente. O `define` instrui o esbuild a substituir cada ocorrência
    // por um valor literal ANTES de gerar o bundle do cliente, eliminando o erro.
    define: {
      // ← FIX DIRETO do ReferenceError: __filename is not defined
      __filename: JSON.stringify(""),
      __dirname: JSON.stringify(""),

      // `global` é usado por algumas libs CJS como alias de globalThis
      global: "globalThis",

      // process.env não existe no browser — mock seguro para evitar erros
      "process.env": JSON.stringify({}),
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV ?? "production"
      ),
    },
    // ──────────────────────────────────────────────────────────────────────

    resolve: {
      alias: [
        // rpc-websockets → versão browser (mantido do original)
        { find: /^rpc-websockets$/, replacement: rpcWsBrowser },
        {
          find: /^rpc-websockets\/dist\/lib\/client$/,
          replacement: rpcWsBrowser,
        },

        // ← NOVO: garante que `buffer` aponta para a implementação browser
        // (necessário pois @solana/web3.js usa Buffer globalmente)
        { find: /^buffer$/, replacement: "buffer/index.js" },

        // aliases Solana browser MJS (mantidos do original)
        ...solanaAliases,
      ],
    },

    // ── CORREÇÃO SSR ────────────────────────────────────────────────────────
    // TanStack Start (SSR) pode tratar @solana/* como "external" (CJS Node),
    // o que faz __filename vazar para o bundle cliente.
    // `ssr.noExternal` força o bundler a incluí-los no bundle e aplicar o `define`.
    ssr: {
      noExternal: ["@solana/web3.js", "@solana/spl-token", "rpc-websockets"],
    },
    // ────────────────────────────────────────────────────────────────────────

    optimizeDeps: {
      // Força pré-bundle pelo esbuild (também aplica o `define` acima)
      include: ["@solana/web3.js", "@solana/spl-token", "buffer"],
      esbuildOptions: {
        // Mesmo define aplicado ao esbuild de pré-bundle
        define: {
          __filename: JSON.stringify(""),
          __dirname: JSON.stringify(""),
          global: "globalThis",
        },
      },
    },

    plugins: [
      mcpPlugin(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        includeAssets: [
          "favicon.ico",
          "offline.html",
          "icons/apple-touch-icon.png",
          "icons/icon-192.png",
          "icons/icon-512.png",
          "icons/maskable-512.png",
        ],
        manifest: false,
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,woff2}"],
          navigateFallback: "/offline.html",
          navigateFallbackDenylist: [
            /^\/~oauth/,
            /^\/api\//,
            /^\/mcp/,
            /^\/\.well-known\//,
            /^\/\.mcp/,
          ],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html-navigations",
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60 * 24,
                },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:js|css|woff2?)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "static-assets",
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin &&
                /\.(?:png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "images",
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
      }),
    ],
  },
});
