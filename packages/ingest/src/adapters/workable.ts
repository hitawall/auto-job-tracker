import type { NormalizedJob } from "@repo/types"
import { inferRemote, parseDate } from "../normalize"

interface WorkableJob {
  id: string
  title: string
  location?: { country?: string; city?: string; region?: string; telecommuting?: boolean }
  url: string
  created_at?: string
}

export async function workable(slug: string): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(`https://www.workable.com/api/accounts/${slug}/jobs`, {
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { jobs: WorkableJob[] }
    return data.jobs.map((j) => {
      const loc = j.location
      const locationText = [loc?.city, loc?.region, loc?.country].filter(Boolean).join(", ")
      return {
        source: "workable",
        source_job_id: j.id,
        title: j.title,
        company: slug,
        location: locationText || null,
        remote: loc?.telecommuting ? "remote" : inferRemote(locationText),
        posted_at: parseDate(j.created_at),
        url: j.url,
        description_md: null,
        raw_payload: j as unknown as Record<string, unknown>,
      }
    })
  } catch {
    return []
  }
}
