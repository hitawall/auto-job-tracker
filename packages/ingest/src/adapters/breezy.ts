import type { NormalizedJob } from "@repo/types"
import { inferRemote, parseDate } from "../normalize"

interface BreezyJob {
  _id: string
  name: string
  location?: { name?: string; city?: string; state?: string; country?: string }
  published_at?: string
  friendly_id: string
}

export async function breezy(slug: string): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(`https://${slug}.breezy.hr/json`, { next: { revalidate: 0 } })
    if (!res.ok) return []
    const data = (await res.json()) as BreezyJob[]
    return data.map((j) => {
      const loc = j.location
      const locationText =
        loc?.name || [loc?.city, loc?.state, loc?.country].filter(Boolean).join(", ")
      return {
        source: "breezy",
        source_job_id: j._id,
        title: j.name,
        company: slug,
        location: locationText || null,
        remote: inferRemote(locationText),
        posted_at: parseDate(j.published_at),
        url: `https://${slug}.breezy.hr/p/${j.friendly_id}`,
        description_md: null,
        raw_payload: j as unknown as Record<string, unknown>,
      }
    })
  } catch {
    return []
  }
}
