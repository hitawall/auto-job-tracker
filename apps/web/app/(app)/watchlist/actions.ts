"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const ATS_PATTERNS: { pattern: RegExp; type: string; slugIndex: number }[] = [
  { pattern: /boards\.greenhouse\.io\/([^/?#]+)/, type: "greenhouse", slugIndex: 1 },
  { pattern: /job-boards\.greenhouse\.io\/([^/?#]+)/, type: "greenhouse", slugIndex: 1 },
  { pattern: /jobs\.lever\.co\/([^/?#]+)/, type: "lever", slugIndex: 1 },
  { pattern: /jobs\.ashbyhq\.com\/([^/?#]+)/, type: "ashby", slugIndex: 1 },
  { pattern: /apply\.workable\.com\/([^/?#]+)/, type: "workable", slugIndex: 1 },
  { pattern: /([^.]+)\.workable\.com/, type: "workable", slugIndex: 1 },
]

function detectAts(url: string): { ats_type: string; ats_slug: string } | null {
  for (const { pattern, type, slugIndex } of ATS_PATTERNS) {
    const m = url.match(pattern)
    if (m?.[slugIndex]) return { ats_type: type, ats_slug: m[slugIndex] }
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
