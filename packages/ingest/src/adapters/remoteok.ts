import type { NormalizedJob } from "@repo/types"
import { htmlToText, parseDate } from "../normalize"

interface RemoteOKJob {
  id?: string
  slug?: string
  company?: string
  position?: string
  location?: string
  url?: string
  date?: string
  description?: string
  tags?: string[]
  logo?: string
}

export async function remoteok(): Promise<NormalizedJob[]> {
  try {
    const res = await fetch("https://remoteok.com/api", {
      headers: { "User-Agent": "auto-job-tracker/1.0 (job aggregator)" },
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as RemoteOKJob[]
    // First element is a metadata object, skip it
    return data
      .slice(1)
      .filter((j): j is RemoteOKJob & { id: string; position: string; url: string } =>
        Boolean(j.id && j.position && j.url),
      )
      .map((j) => ({
        source: "remoteok",
        source_job_id: j.id,
        title: j.position,
        company: j.company ?? "Unknown",
        location: j.location ?? "Remote",
        remote: "remote",
        posted_at: parseDate(j.date),
        url: j.url,
        description_md: htmlToText(j.description),
        raw_payload: j as unknown as Record<string, unknown>,
      }))
  } catch {
    return []
  }
}
