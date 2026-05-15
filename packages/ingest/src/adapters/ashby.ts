import type { NormalizedJob } from "@repo/types"
import { htmlToText, inferRemote, parseDate } from "../normalize"

interface AshbyPosting {
  id: string
  title: string
  locationName?: string
  isRemote?: boolean
  publishedDate?: string
  jobUrl: string
  descriptionHtml?: string
  employmentType?: string
}

export async function ashby(slug: string): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, {
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { jobPostings: AshbyPosting[] }
    return data.jobPostings.map((j) => ({
      source: "ashby",
      source_job_id: j.id,
      title: j.title,
      company: slug,
      location: j.locationName ?? null,
      remote: j.isRemote ? "remote" : inferRemote(j.locationName),
      posted_at: parseDate(j.publishedDate),
      url: j.jobUrl,
      description_md: htmlToText(j.descriptionHtml),
      raw_payload: j as unknown as Record<string, unknown>,
    }))
  } catch {
    return []
  }
}
