import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { score } from "@repo/match"
import { sendJobAlert } from "@/lib/resend"
import type { Preference } from "@repo/types"

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const SCORE_THRESHOLD = 30
const MAX_JOBS_PER_USER = 200

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = supabaseAdmin()
  const now = new Date()
  const defaultCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const { data: prefs, error: prefsError } = await supabase
    .from("preferences")
    .select("*")
    .eq("alert_email", true)

  if (prefsError) {
    console.error("fetch preferences error", prefsError.message)
    return NextResponse.json({ error: prefsError.message }, { status: 500 })
  }

  let emailsSent = 0
  const debug: Record<string, unknown>[] = []

  for (const pref of prefs ?? []) {
    const cutoff = pref.last_alert_sent_at ?? defaultCutoff
    const d: Record<string, unknown> = { cutoff }

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id,title,company,location,remote,url,description_md,posted_at")
      .gte("posted_at", cutoff)
      .order("posted_at", { ascending: false })
      .limit(MAX_JOBS_PER_USER)

    d.jobs_found = jobs?.length ?? 0
    d.jobs_error = jobsError?.message ?? null

    if (!jobs?.length) { debug.push(d); continue }

    const prefInput: Omit<Preference, "user_id"> = {
      job_titles: pref.job_titles ?? [],
      locations: pref.locations ?? [],
      remote_modes: pref.remote_modes ?? [],
      min_salary_inr: pref.min_salary_inr ?? null,
      keywords_must: pref.keywords_must ?? [],
      keywords_block: pref.keywords_block ?? [],
      seniority: pref.seniority ?? [],
    }

    const matches: { job_id: string; score: number; reasons: string[]; job: typeof jobs[0] }[] = []
    const sampleScores: { title: string; score: number; reasons: string[] }[] = []

    for (const job of jobs) {
      const result = score(
        { title: job.title, company: job.company, location: job.location, remote: job.remote, description_md: job.description_md },
        prefInput,
      )
      if (sampleScores.length < 5) sampleScores.push({ title: job.title, score: result.score, reasons: result.reasons })
      if (result.score >= SCORE_THRESHOLD) {
        matches.push({ job_id: job.id, score: result.score, reasons: result.reasons, job })
      }
    }

    d.matches_found = matches.length
    d.sample_scores = sampleScores

    if (matches.length === 0) { debug.push(d); continue }

    // Upsert match records
    await supabase.from("job_matches").upsert(
      matches.map(({ job_id, score: s, reasons }) => ({
        user_id: pref.user_id, job_id, score: s, reason: reasons, status: "new", matched_at: now.toISOString(),
      })),
      { onConflict: "user_id,job_id", ignoreDuplicates: true },
    )

    const { data: userData } = await supabase.auth.admin.getUserById(pref.user_id)
    const email = userData?.user?.email
    d.email_found = !!email

    if (email) {
      const sent = await sendJobAlert(
        email,
        matches.map(({ job, score: s, reasons }) => ({
          title: job.title, company: job.company, location: job.location, url: job.url, score: s, reasons,
        })),
      )
      d.email_sent = sent
      if (sent) {
        emailsSent++
        await supabase.from("preferences").update({ last_alert_sent_at: now.toISOString() }).eq("user_id", pref.user_id)
      } else {
        console.error(`[alerts] email failed for user ${pref.user_id}`)
      }
    }

    debug.push(d)
  }

  return NextResponse.json({ ok: true, users: prefs?.length ?? 0, emails_sent: emailsSent, debug })
}
