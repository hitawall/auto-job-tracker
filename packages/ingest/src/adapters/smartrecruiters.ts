import type { NormalizedJob } from "@repo/types"
import { inferRemote, parseDate } from "../normalize"

interface SRPosting {
  id: string
  name: string
  location?: { city?: string; region?: string; country?: string; remote?: boolean }
  releasedDate?: string
  ref: string
}

interface SRResponse {
  content: SRPosting[]
  totalFound: number
}

export async function smartrecruiters(slug: string): Promise<NormalizedJob[]> {
  const jobs: NormalizedJob[] = []
  let offset = 0
  const limit = 100
  let total = Infinity

  while (offset < Math.min(total, 1000)) {
    try {
      const res = await fetch(
        `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=${limit}&offset=${offset}`,
        { next: { revalidate: 0 } },
      )
      if (!res.ok) break
      const data = (await res.json()) as SRResponse
      if (!data.content?.length) break
      total = data.totalFound
      for (const j of data.content) {
        const loc = j.location
        const locationText = [loc?.city, loc?.region, loc?.country].filter(Boolean).join(", ")
        jobs.push({
          source: "smartrecruiters",
          source_job_id: j.id,
          title: j.name,
          company: slug,
          location: locationText || null,
          remote: loc?.remote ? "remote" : inferRemote(locationText),
          posted_at: parseDate(j.releasedDate),
          url: j.ref,
          description_md: null,
          raw_payload: j as unknown as Record<string, unknown>,
        })
      }
      offset += limit
    } catch {
      break
    }
  }

  return jobs
}
