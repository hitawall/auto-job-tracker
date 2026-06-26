import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-6">
            <span className="font-semibold text-primary">Job Tracker</span>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/jobs"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Jobs
            </Link>
            <Link
              href="/watchlist"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Watchlist
            </Link>
            <Link
              href="/preferences"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Preferences
            </Link>
            <Link
              href="/about"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </Link>
          </nav>
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
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}
