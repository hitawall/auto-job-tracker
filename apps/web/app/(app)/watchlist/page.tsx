import { createClient } from "@/lib/supabase/server"
import { addPortal, togglePortal, deletePortal } from "./actions"

const ATS_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workable: "Workable",
}

export default async function WatchlistPage() {
  const supabase = await createClient()
  const { data: portals } = await supabase
    .from("company_portals")
    .select("*")
    .order("created_at", { ascending: false })

  const fieldClass =
    "w-full rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Company Watchlist</h1>
        <p className="text-sm text-muted-foreground">
          Track specific company career pages. Paste any Greenhouse, Lever, Ashby, or Workable URL
          and the ATS type is auto-detected.
        </p>
      </div>

      <form action={addPortal} className="rounded-2xl border bg-card p-5 mb-6">
        <h2 className="font-semibold text-foreground mb-4">Add company</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            name="company_name"
            required
            placeholder="Razorpay"
            className={fieldClass}
          />
          <input
            name="career_url"
            required
            type="url"
            placeholder="https://jobs.lever.co/razorpay"
            className={fieldClass}
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Known ATS (fast): boards.greenhouse.io, jobs.lever.co, jobs.ashbyhq.com, apply.workable.com
          <br />
          Any other URL is scraped via JSON-LD — works for most company career pages.
        </p>
      </form>

      {!portals?.length ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">No companies tracked yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Add one above to start tracking their job openings.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {portals.map((p) => (
            <li key={p.id} className="rounded-2xl border bg-card p-4 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className={`font-medium text-sm ${p.is_active ? "text-foreground" : "text-muted-foreground line-through"}`}>
                  {p.company_name}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{p.career_url}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {p.ats_type ? (
                  <span className="rounded-full bg-primary/10 text-primary text-xs px-2.5 py-0.5 font-medium">
                    {ATS_LABELS[p.ats_type] ?? p.ats_type}
                  </span>
                ) : (
                  <span className="rounded-full bg-secondary text-secondary-foreground text-xs px-2.5 py-0.5 font-medium">
                    JSON-LD
                  </span>
                )}
                <form action={togglePortal.bind(null, p.id, !p.is_active)}>
                  <button
                    type="submit"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-muted"
                  >
                    {p.is_active ? "Pause" : "Resume"}
                  </button>
                </form>
                <form action={deletePortal.bind(null, p.id)}>
                  <button
                    type="submit"
                    className="text-xs text-destructive hover:opacity-70 transition-opacity cursor-pointer px-2 py-1 rounded-lg hover:bg-destructive/10"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
