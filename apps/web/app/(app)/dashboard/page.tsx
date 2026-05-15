import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
          <span className="font-semibold text-foreground">Job Tracker</span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          Welcome back{user.email ? `, ${user.email.split("@")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground mb-8">
          Your job tracker dashboard. More features coming soon.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Jobs ingested", value: "—", soon: true },
            { label: "New matches today", value: "—", soon: true },
            { label: "Applications tracked", value: "—", soon: true },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border bg-card p-6 text-card-foreground"
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-3xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
