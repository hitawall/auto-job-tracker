import type { NormalizedJob } from "@repo/types"
import { inferRemote, parseDate } from "../normalize"

interface RecruiteeOffer {
  id: number
  title: string
  location: string
  remote_option?: string
  published_at?: string
  careers_url: string
}

export async function recruitee(slug: string): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(`https://${slug}.recruitee.com/api/offers/`, {
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { offers: RecruiteeOffer[] }
    return (data.offers ?? []).map((j) => {
      const remote =
        j.remote_option === "remote_only"
          ? "remote"
          : j.remote_option === "partly_remote"
            ? "hybrid"
            : inferRemote(j.location)
      return {
        source: "recruitee",
        source_job_id: String(j.id),
        title: j.title,
        company: slug,
        location: j.location || null,
        remote,
        posted_at: parseDate(j.published_at),
        url: j.careers_url,
        description_md: null,
        raw_payload: j as unknown as Record<string, unknown>,
      }
    })
  } catch {
    return []
  }
}
