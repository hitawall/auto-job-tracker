import type { RemoteMode } from "@repo/types"

const REMOTE_PATTERNS = /\b(remote|distributed|anywhere|wfh|work from home)\b/i
const HYBRID_PATTERNS = /\b(hybrid|flexible|part.?remote)\b/i

export function inferRemote(text: string | null | undefined): RemoteMode {
  if (!text) return "unknown"
  if (REMOTE_PATTERNS.test(text)) return "remote"
  if (HYBRID_PATTERNS.test(text)) return "hybrid"
  return "onsite"
}

export function htmlToText(html: string | null | undefined): string {
  if (!html) return ""
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function parseDate(value: string | number | null | undefined): string | null {
  if (!value) return null
  const d = typeof value === "number" ? new Date(value) : new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}
