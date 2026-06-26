import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { greenhouse, lever, ashby, workable, workday, smartrecruiters, breezy, recruitee, remoteok, hn, companies } from "@repo/ingest"
import type { NormalizedJob } from "@repo/types"

const COMPANY_ADAPTERS = {
  greenhouse,
  lever,
  ashby,
  workable,
  workday,
  smartrecruiters,
  breezy,
  recruitee,
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
    ignoreDuplicates: false,
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
  const sources: Record<string, number> = {}

  // Expire jobs older than 30 days
  const expiryCutoff = new Date(Date.now() - 30 * 86400_000).toISOString()
  const { count: expired } = await supabase
    .from("jobs")
    .delete({ count: "exact" })
    .lt("posted_at", expiryCutoff)
  console.log(`[cleanup] expired ${expired ?? 0} jobs older than 30 days`)

  // Per-company adapters
  for (const [source, slugs] of Object.entries(companies) as [CompanySource, string[]][]) {
    const adapter = COMPANY_ADAPTERS[source]
    if (!adapter) continue
    for (const slug of slugs) {
      let jobs: NormalizedJob[] = []
      try {
        jobs = await adapter(slug)
      } catch (err) {
        console.error(`[${source}/${slug}] adapter error:`, err)
      }
      console.log(`[${source}/${slug}] ${jobs.length} jobs`)
      await upsertJobs(supabase, jobs)
      total += jobs.length
      sources[source] = (sources[source] ?? 0) + jobs.length
    }
  }

  // User-configured portals from company_watchlist
  const { data: portals } = await supabase
    .from("company_portals")
    .select("company_name,ats_type,ats_slug")
    .eq("is_active", true)
    .not("ats_type", "is", null)
    .not("ats_slug", "is", null)

  for (const portal of portals ?? []) {
    const adapter = COMPANY_ADAPTERS[portal.ats_type as CompanySource]
    if (!adapter) continue
    let jobs: NormalizedJob[] = []
    try {
      jobs = await adapter(portal.ats_slug)
    } catch (err) {
      console.error(`[watchlist/${portal.company_name}] adapter error:`, err)
    }
    console.log(`[watchlist/${portal.company_name}] ${jobs.length} jobs`)
    await upsertJobs(supabase, jobs)
    total += jobs.length
    sources.watchlist = (sources.watchlist ?? 0) + jobs.length
  }

  // Global feeds
  const [remoteJobs, hnJobs] = await Promise.all([remoteok(), hn()])
  await upsertJobs(supabase, remoteJobs)
  await upsertJobs(supabase, hnJobs)
  total += remoteJobs.length + hnJobs.length
  sources.remoteok = remoteJobs.length
  sources.hn = hnJobs.length

  return NextResponse.json({ ok: true, total, sources })
}
