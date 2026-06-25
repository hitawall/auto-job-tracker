"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function savePreferences(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  function parseList(key: string): string[] {
    return (formData.get(key) as string | null)
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  }

  const remoteRaw = formData.getAll("remote_modes") as string[]

  const payload = {
    user_id: user.id,
    job_titles: parseList("job_titles"),
    locations: parseList("locations"),
    remote_modes: remoteRaw,
    min_salary_usd: Number(formData.get("min_salary_usd")) || null,
    keywords_must: parseList("keywords_must"),
    keywords_block: parseList("keywords_block"),
    seniority: parseList("seniority"),
    alert_email: formData.get("alert_email") === "on",
    updated_at: new Date().toISOString(),
  }

  await supabase.from("preferences").upsert(payload, { onConflict: "user_id" })
  revalidatePath("/preferences")
}
