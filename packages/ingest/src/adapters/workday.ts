import type { NormalizedJob } from "@repo/types"
import { inferRemote } from "../normalize"

interface WorkdayPosting {
  title: string
  externalPath: string
  locationsText: string
  postedOn: string
  bulletFields: string[]
}

interface WorkdayResponse {
  jobPostings: WorkdayPosting[]
  total: number
}

function parseWorkdayDate(raw: string | undefined): string | null {
  if (!raw) return null
  if (/today/i.test(raw)) return new Date().toISOString()
  if (/yesterday/i.test(raw)) {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString()
  }
  const m = raw.match(/(\d+)\+?\s+days?\s+ago/i)
  if (m) {
    const d = new Date(); d.setDate(d.getDate() - parseInt(m[1], 10)); return d.toISOString()
  }
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// Slug format: "{subdomain}|{wdN}|{tenant}"  e.g. "salesforce|1|External_Career_Site"
export async function workday(slug: string): Promise<NormalizedJob[]> {
  const parts = slug.split("|")
  if (parts.length !== 3) return []
  const [subdomain, wdNum, tenant] = parts
  const base = `https://${subdomain}.wd${wdNum}.myworkdayjobs.com`
  const apiUrl = `${base}/wday/cxs/${tenant}/jobs`
  const jobBase = `${base}/${tenant}/job`

  const jobs: NormalizedJob[] = []
  const limit = 20
  let offset = 0
  let total = Infinity

  while (offset < Math.min(total, 500)) {
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit, offset, searchText: "", locations: [] }),
        next: { revalidate: 0 },
      })
      if (!res.ok) break
      const data = (await res.json()) as WorkdayResponse
      if (!data.jobPostings?.length) break
      total = data.total
      for (const j of data.jobPostings) {
        jobs.push({
          source: "workday",
          source_job_id: j.externalPath,
          title: j.title,
          company: subdomain,
          location: j.locationsText || null,
          remote: inferRemote(`${j.locationsText} ${j.bulletFields.join(" ")}`),
          posted_at: parseWorkdayDate(j.postedOn),
          url: `${jobBase}${j.externalPath}`,
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
