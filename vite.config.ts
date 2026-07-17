// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

const resolveBrowserMjs = (pkg: string, relPath: string) =>
  fileURLToPath(new URL(`./node_modules/${pkg}/${relPath}`, import.meta.url));

const rpcWsBrowser = resolveBrowserMjs("rpc-websockets", "dist/index.browser.mjs");
const solanaAliases = [
  { find: /^@solana\/codecs$/, replacement: resolveBrowserMjs("@solana/codecs", "dist/index.browser.mjs") },
  { find: /^@solana\/codecs-core$/, replacement: resolveBrowserMjs("@solana/codecs-core", "dist/index.browser.mjs") },
  { find: /^@solana\/codecs-numbers$/, replacement: resolveBrowserMjs("@solana/codecs-numbers", "dist/index.browser.mjs") },
  { find: /^@solana\/codecs-strings$/, replacement: resolveBrowserMjs("@solana/codecs-strings", "dist/index.browser.mjs") },
  { find: /^@solana\/codecs-data-structures$/, replacement: resolveBrowserMjs("@solana/codecs-data-structures", "dist/index.browser.mjs") },
  { find: /^@solana\/options$/, replacement: resolveBrowserMjs("@solana/options", "dist/index.browser.mjs") },
  { find: /^@solana\/errors$/, replacement: resolveBrowserMjs("@solana/errors", "dist/index.browser.mjs") },
];

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: [
        { find: /^rpc-websockets$/, replacement: rpcWsBrowser },
        { find: /^rpc-websockets\/dist\/lib\/client$/, replacement: rpcWsBrowser },
        ...solanaAliases,
      ],
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
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/mcp/, /^\/\.well-known\//, /^\/\.mcp/],
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
                expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:js|css|woff2?)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "static-assets",
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "images",
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
