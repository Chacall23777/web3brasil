import type { SVGProps } from "react";

export const XIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M18.244 2H21.5l-7.53 8.61L22.5 22h-6.86l-5.37-6.98L3.98 22H.72l8.06-9.22L1.5 2h7.03l4.86 6.42L18.244 2Zm-1.2 18h1.9L7.06 4h-2L17.044 20Z" />
  </svg>
);
export const TelegramIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M9.78 15.53 9.6 19.1c.26 0 .38-.11.52-.24l1.25-1.2 2.6 1.9c.47.26.81.13.94-.44l1.7-8c.16-.72-.26-1-.72-.83L4.5 13.13c-.72.28-.71.68-.12.86l2.6.81 6.03-3.8c.28-.18.54-.08.33.11" />
  </svg>
);
export const WhatsappIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M20.5 3.5A11 11 0 0 0 3.6 17.3L2 22l4.8-1.6a11 11 0 0 0 13.7-16.9ZM12 20.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-2.8 1 .9-2.7-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.5.1-.6.8-.8 1c-.1.1-.3.2-.5 0a6.7 6.7 0 0 1-2-1.3 7.4 7.4 0 0 1-1.4-1.7c-.1-.2 0-.4.1-.5l.4-.4c.1-.2.2-.3.3-.5s0-.4 0-.5-.5-1.3-.7-1.7-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7s1.8 2.7 4.4 3.8a4.9 4.9 0 0 0 2 .4 3.7 3.7 0 0 0 2.5-1c.3-.3.7-1.2.8-1.4s.1-.3 0-.4Z" />
  </svg>
);
export const InstagramIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
  </svg>
);
export const GithubIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 .5C5.73.5.98 5.24.98 11.52c0 5.02 3.26 9.28 7.78 10.78.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.1-3.16.69-3.83-1.34-3.83-1.34-.52-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.73 2.65 1.23 3.3.94.1-.73.4-1.23.72-1.51-2.52-.29-5.17-1.26-5.17-5.6 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.14 1.16a10.9 10.9 0 0 1 5.72 0c2.18-1.47 3.14-1.16 3.14-1.16.62 1.57.23 2.73.11 3.02.73.79 1.17 1.8 1.17 3.04 0 4.35-2.65 5.31-5.18 5.59.41.35.77 1.04.77 2.1 0 1.52-.01 2.74-.01 3.11 0 .3.2.66.79.55A11.03 11.03 0 0 0 23.02 11.5C23.02 5.24 18.27.5 12 .5Z" />
  </svg>
);

// Cores oficiais das marcas (usadas na versão "colorida" das redes)
export const BRAND_COLORS = {
  x: "#000000",
  telegram: "#229ED9",
  whatsapp: "#25D366",
  instagram: "#E1306C",
  github: "#181717",
} as const;
