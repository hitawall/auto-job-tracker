import { createClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { count: jobCount } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })

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
          { label: "New matches today", value: "—" },
          { label: "Applications tracked", value: "—" },
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
