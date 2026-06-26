import type { NormalizedJob } from "@repo/types"
import { inferRemote, parseDate } from "../normalize"

interface WorkableResult {
  shortcode: string
  title: string
  remote: boolean
  location?: { country?: string; city?: string; region?: string; display?: string }
  published?: string
  workplace?: string
}

interface WorkableResponse {
  total: number
  results: WorkableResult[]
  nextPage?: string
}

export async function workable(slug: string): Promise<NormalizedJob[]> {
  const jobs: NormalizedJob[] = []
  const url = `https://apply.workable.com/api/v3/accounts/${slug}/jobs`
  const baseBody = { query: "", location: [], department: [], worktype: [], remote: [] }
  let token: string | undefined

  while (true) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { ...baseBody, token } : baseBody),
        next: { revalidate: 0 },
      })
      if (!res.ok) break
      const data = (await res.json()) as WorkableResponse
      if (!data.results?.length) break
      for (const j of data.results) {
        const loc = j.location
        const locationText = loc?.display || [loc?.city, loc?.region, loc?.country].filter(Boolean).join(", ")
        jobs.push({
          source: "workable",
          source_job_id: j.shortcode,
          title: j.title,
          company: slug,
          location: locationText || null,
          remote: j.remote ? "remote" : inferRemote(locationText),
          posted_at: parseDate(j.published),
          url: `https://apply.workable.com/${slug}/j/${j.shortcode}/`,
          description_md: null,
          raw_payload: j as unknown as Record<string, unknown>,
        })
      }
      if (!data.nextPage || jobs.length >= 500) break
      token = data.nextPage
    } catch {
      break
    }
  }

  return jobs
}
