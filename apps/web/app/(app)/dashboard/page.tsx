import { createClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)

  const [{ count: jobCount }, { count: matchCount }, { count: appliedCount }] = await Promise.all([
    supabase.from("jobs").select("*", { count: "exact", head: true }),
    supabase
      .from("job_matches")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .gte("matched_at", todayUtc.toISOString())
      .gte("score", 30),
    supabase
      .from("job_matches")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("status", "applied"),
  ])

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-1">
        Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}
      </h1>
      <p className="text-muted-foreground mb-8">
        Your job tracker dashboard.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Jobs indexed", value: jobCount ?? "—" },
          { label: "New matches today", value: matchCount ?? 0 },
          { label: "Applications tracked", value: appliedCount ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>
    </>
  )
}
