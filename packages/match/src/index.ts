import type { NormalizedJob, Preference } from "@repo/types"

export interface MatchResult {
  score: number
  reasons: string[]
}

type ScoredJob = Pick<
  NormalizedJob,
  "title" | "company" | "location" | "remote" | "description_md"
> & { min_salary_inr?: number | null }

function lower(s: string | null | undefined) {
  return (s ?? "").toLowerCase()
}

function containsAny(haystack: string, needles: string[]): string | undefined {
  return needles.find((n) => haystack.includes(n.toLowerCase()))
}

export function score(job: ScoredJob, prefs: Omit<Preference, "user_id">): MatchResult {
  const reasons: string[] = []
  let points = 0

  const corpus = [job.title, job.company, job.location, job.description_md]
    .map(lower)
    .join(" ")

  // ── Block keywords (hard stop) ────────────────────────────────────────────
  if (prefs.keywords_block.length > 0) {
    const hit = containsAny(corpus, prefs.keywords_block)
    if (hit) return { score: 0, reasons: [`blocked: "${hit}"`] }
  }

  // ── Title match ───────────────────────────────────────────────────────────
  if (prefs.job_titles.length > 0) {
    const hit = containsAny(lower(job.title), prefs.job_titles)
    if (hit) {
      points += 40
      reasons.push(`title matches "${hit}"`)
    } else {
      // Title is the primary signal — no match means not relevant
      return { score: 0, reasons: ["title does not match any preferred title"] }
    }
  }

  // ── Must-have keywords ────────────────────────────────────────────────────
  for (const kw of prefs.keywords_must) {
    if (corpus.includes(kw.toLowerCase())) {
      points += 10
      reasons.push(`keyword "${kw}" present`)
    } else {
      return { score: 0, reasons: [`required keyword "${kw}" missing`] }
    }
  }

  // ── Remote mode ───────────────────────────────────────────────────────────
  if (prefs.remote_modes.length > 0) {
    if (prefs.remote_modes.includes(job.remote)) {
      points += 20
      reasons.push(`remote mode "${job.remote}" matches`)
    } else if (job.remote !== "unknown") {
      return { score: 0, reasons: [`remote mode "${job.remote}" not in preferences`] }
    }
  }

  // ── Location ──────────────────────────────────────────────────────────────
  if (prefs.locations.length > 0 && job.remote !== "remote") {
    const hit = containsAny(lower(job.location), prefs.locations)
    if (hit) {
      points += 15
      reasons.push(`location matches "${hit}"`)
    } else {
      return { score: 0, reasons: [`location "${job.location ?? "unknown"}" not in preferences`] }
    }
  }

  // ── Seniority ─────────────────────────────────────────────────────────────
  if (prefs.seniority.length > 0) {
    const hit = containsAny(lower(job.title), prefs.seniority)
    if (hit) {
      points += 15
      reasons.push(`seniority "${hit}" in title`)
    }
  }

  // ── Salary floor ──────────────────────────────────────────────────────────
  // Only filter when the job actually publishes a salary — most Indian postings don't.
  if (prefs.min_salary_inr && job.min_salary_inr) {
    if (job.min_salary_inr < prefs.min_salary_inr) {
      return { score: 0, reasons: [`salary ₹${job.min_salary_inr} below floor ₹${prefs.min_salary_inr}`] }
    }
    points += 10
    reasons.push("salary meets floor")
  }

  return { score: points, reasons }
}
