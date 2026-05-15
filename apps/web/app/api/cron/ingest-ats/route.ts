import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { greenhouse, lever, ashby, workable, remoteok, hn, companies } from "@repo/ingest"
import type { NormalizedJob } from "@repo/types"

const COMPANY_ADAPTERS = {
  greenhouse,
  lever,
  ashby,
  workable,
} as const

type CompanySource = keyof typeof COMPANY_ADAPTERS

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function upsertJobs(supabase: ReturnType<typeof supabaseAdmin>, jobs: NormalizedJob[]) {
  if (jobs.length === 0) return
  const { error } = await supabase.from("jobs").upsert(jobs, {
    onConflict: "source,source_job_id",
    ignoreDuplicates: true,
  })
  if (error) console.error("upsert error", error.message)
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = supabaseAdmin()
  let total = 0

  // Per-company adapters
  for (const [source, slugs] of Object.entries(companies) as [CompanySource, string[]][]) {
    const adapter = COMPANY_ADAPTERS[source]
    if (!adapter) continue
    for (const slug of slugs) {
      const jobs = await adapter(slug)
      await upsertJobs(supabase, jobs)
      total += jobs.length
    }
  }

  // Global feeds
  const [remoteJobs, hnJobs] = await Promise.all([remoteok(), hn()])
  await upsertJobs(supabase, remoteJobs)
  await upsertJobs(supabase, hnJobs)
  total += remoteJobs.length + hnJobs.length

  return NextResponse.json({ ok: true, ingested: total })
}
