import type { NormalizedJob } from "@repo/types"
import { inferRemote, parseDate } from "../normalize"

interface LeverPosting {
  id: string
  text: string
  createdAt: number
  hostedUrl: string
  descriptionPlain?: string
  categories?: { location?: string; team?: string }
  workplaceType?: string
}

export async function lever(slug: string): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, {
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as LeverPosting[]
    return data.map((j) => {
      const locationText = j.categories?.location ?? ""
      const workplaceHint = j.workplaceType ?? locationText
      return {
        source: "lever",
        source_job_id: j.id,
        title: j.text,
        company: slug,
        location: locationText || null,
        remote: inferRemote(workplaceHint),
        posted_at: parseDate(j.createdAt),
        url: j.hostedUrl,
        description_md: j.descriptionPlain ?? null,
        raw_payload: j as Record<string, unknown>,
      }
    })
  } catch {
    return []
  }
}
