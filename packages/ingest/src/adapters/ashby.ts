import type { NormalizedJob } from "@repo/types"
import { htmlToText, inferRemote, parseDate } from "../normalize"

interface AshbyPosting {
  id: string
  title: string
  location?: string
  isRemote?: boolean
  workplaceType?: string
  publishedAt?: string
  jobUrl: string
  descriptionHtml?: string
}

export async function ashby(slug: string): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, {
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { jobs?: AshbyPosting[]; jobPostings?: AshbyPosting[] }
    const postings = data.jobs ?? data.jobPostings ?? []
    return postings.map((j) => ({
      source: "ashby",
      source_job_id: j.id,
      title: j.title,
      company: slug,
      location: j.location ?? null,
      remote: j.isRemote ? "remote" : inferRemote(j.workplaceType ?? j.location),
      posted_at: parseDate(j.publishedAt),
      url: j.jobUrl,
      description_md: htmlToText(j.descriptionHtml),
      raw_payload: j as unknown as Record<string, unknown>,
    }))
  } catch {
    return []
  }
}
