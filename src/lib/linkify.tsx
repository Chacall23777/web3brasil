import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { safeHttpUrl } from "./safe-url";

// Matches URLs (with or without protocol) and @mentions
const PATTERN = /(\bhttps?:\/\/[^\s<>"]+|\bwww\.[^\s<>"]+|@[A-Za-z0-9_.-]{2,32})/g;

/**
 * Render plain text with clickable URLs and @mentions.
 * URLs open in a new tab (rel=noopener nofollow ugc).
 * @mentions link to /u/n/$name (name-based lookup route).
 */
export function linkifyText(text: string): ReactNode {
  if (!text) return null;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const matches = text.matchAll(PATTERN);
  for (const m of matches) {
    const match = m[0];
    const idx = m.index ?? 0;
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
    if (match.startsWith("@")) {
      const name = match.slice(1);
      parts.push(
        <Link
          key={`m-${key++}`}
          to="/u/n/$name"
          params={{ name }}
          className="text-primary hover:underline font-medium"
        >
          @{name}
        </Link>,
      );
    } else {
      // Strip trailing punctuation that is unlikely to belong to the URL
      let url = match;
      let trail = "";
      const trailMatch = url.match(/[),.;:!?]+$/);
      if (trailMatch) {
        trail = trailMatch[0];
        url = url.slice(0, -trail.length);
      }
      const href = safeHttpUrl(url.startsWith("http") ? url : `https://${url}`);
      if (href) {
        parts.push(
          <a
            key={`u-${key++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="text-primary hover:underline break-all"
          >
            {url}
          </a>,
        );
        if (trail) parts.push(trail);
      } else {
        parts.push(match);
      }
    }
    lastIndex = idx + match.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}
