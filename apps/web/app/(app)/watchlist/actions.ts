"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

type AtsPattern =
  | { pattern: RegExp; type: string; slugIndex: number; buildSlug?: undefined }
  | { pattern: RegExp; type: string; slugIndex?: undefined; buildSlug: (m: RegExpMatchArray) => string }

const ATS_PATTERNS: AtsPattern[] = [
  { pattern: /boards\.greenhouse\.io\/([^/?#]+)/, type: "greenhouse", slugIndex: 1 },
  { pattern: /job-boards\.greenhouse\.io\/([^/?#]+)/, type: "greenhouse", slugIndex: 1 },
  { pattern: /jobs\.lever\.co\/([^/?#]+)/, type: "lever", slugIndex: 1 },
  { pattern: /jobs\.ashbyhq\.com\/([^/?#]+)/, type: "ashby", slugIndex: 1 },
  { pattern: /apply\.workable\.com\/([^/?#]+)/, type: "workable", slugIndex: 1 },
  { pattern: /([^.]+)\.workable\.com/, type: "workable", slugIndex: 1 },
  {
    pattern: /([a-zA-Z0-9_-]+)\.(wd\d+)\.myworkdayjobs\.com\/([a-zA-Z0-9_-]+)/,
    type: "workday",
    buildSlug: (m) => `${m[1]}|${m[2].replace("wd", "")}|${m[3]}`,
  },
  { pattern: /jobs\.smartrecruiters\.com\/([^/?#]+)/, type: "smartrecruiters", slugIndex: 1 },
  { pattern: /([^.]+)\.smartrecruiters\.com/, type: "smartrecruiters", slugIndex: 1 },
  { pattern: /([^.]+)\.breezy\.hr/, type: "breezy", slugIndex: 1 },
  { pattern: /([^.]+)\.recruitee\.com/, type: "recruitee", slugIndex: 1 },
]

function detectAts(url: string): { ats_type: string; ats_slug: string } | null {
  for (const entry of ATS_PATTERNS) {
    const m = url.match(entry.pattern)
    if (!m) continue
    const slug = entry.buildSlug ? entry.buildSlug(m) : m[entry.slugIndex]
    if (slug) return { ats_type: entry.type, ats_slug: slug }
  }
  return null
}

export async function addPortal(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const company_name = (formData.get("company_name") as string).trim()
  const career_url = (formData.get("career_url") as string).trim()
  if (!company_name || !career_url) return

  const detected = detectAts(career_url)

  await supabase.from("company_portals").insert({
    company_name,
    career_url,
    ats_type: detected?.ats_type ?? null,
    ats_slug: detected?.ats_slug ?? null,
    is_active: true,
    added_by: user.id,
  })

  revalidatePath("/watchlist")
}

export async function togglePortal(id: string, is_active: boolean) {
  const supabase = await createClient()
  await supabase.from("company_portals").update({ is_active }).eq("id", id)
  revalidatePath("/watchlist")
}

export async function deletePortal(id: string) {
  const supabase = await createClient()
  await supabase.from("company_portals").delete().eq("id", id)
  revalidatePath("/watchlist")
}
