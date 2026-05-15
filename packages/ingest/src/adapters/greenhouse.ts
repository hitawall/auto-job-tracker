import type { NormalizedJob } from "@repo/types"
import { htmlToText, inferRemote, parseDate } from "../normalize"

interface GHJob {
  id: number
  title: string
  location: { name: string }
  absolute_url: string
  content?: string
  updated_at?: string
}

export async function greenhouse(slug: string): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
      { next: { revalidate: 0 } },
    )
    if (!res.ok) return []
    const data = (await res.json()) as { jobs: GHJob[] }
    return data.jobs.map((j) => ({
      source: "greenhouse",
      source_job_id: String(j.id),
      title: j.title,
      company: slug,
      location: j.location.name ?? null,
      remote: inferRemote(`${j.title} ${j.location.name}`),
      posted_at: parseDate(j.updated_at),
      url: j.absolute_url,
      description_md: htmlToText(j.content),
      raw_payload: j as Record<string, unknown>,
    }))
  } catch {
    return []
  }
}
