import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { FilterBar } from "./FilterBar"
import type { RemoteMode } from "@repo/types"

const SOURCE_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workable: "Workable",
  remoteok: "RemoteOK",
  hn: "HN",
  linkedin: "LinkedIn",
  portal: "Portal",
  indeed: "Indeed",
  zip_recruiter: "ZipRecruiter",
}

const REMOTE_CHIPS: Record<string, string> = {
  remote: "bg-secondary text-secondary-foreground",
  hybrid: "bg-accent text-accent-foreground",
  onsite: "bg-muted text-muted-foreground",
  unknown: "bg-muted text-muted-foreground",
}

interface SearchParams {
  q?: string
  company?: string
  location?: string
  remote?: string
  since?: string
  page?: string
}

const PAGE_SIZE = 25

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const filters = await searchParams
  const supabase = await createClient()

  const page = Math.max(1, Number(filters.page ?? 1))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from("jobs")
    .select("id,title,company,location,remote,posted_at,url,source", { count: "exact" })
    .order("posted_at", { ascending: false, nullsFirst: false })
    .range(from, to)

  if (filters.q) {
    query = query.ilike("title", `%${filters.q}%`)
  }
  if (filters.company) {
    query = query.ilike("company", `%${filters.company}%`)
  }
  if (filters.location) {
    query = query.ilike("location", `%${filters.location}%`)
  }
  if (filters.remote && ["remote", "hybrid", "onsite"].includes(filters.remote)) {
    query = query.eq("remote", filters.remote as RemoteMode)
  }
  if (filters.since) {
    const hours = parseInt(filters.since, 10)
    if (!isNaN(hours)) {
      const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString()
      query = query.gte("posted_at", cutoff)
    }
  }

  const { data: jobs, count } = await query

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          {count ?? 0} postings indexed
        </p>
      </div>

      <Suspense>
        <FilterBar />
      </Suspense>

      {!jobs || jobs.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">No jobs match your filters.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try broadening your search or wait for the next ingest run.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border bg-card p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{job.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {job.company}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="rounded-full bg-primary/10 text-primary text-xs px-2.5 py-0.5 font-medium">
                      {SOURCE_LABELS[job.source] ?? job.source}
                    </span>
                    <span
                      className={`rounded-full text-xs px-2.5 py-0.5 font-medium ${REMOTE_CHIPS[job.remote as RemoteMode] ?? REMOTE_CHIPS.unknown}`}
                    >
                      {job.remote === "unknown" ? "—" : job.remote}
                    </span>
                  </div>
                </div>
                {job.posted_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(job.posted_at).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {page > 1 && (
            <a
              href={`/jobs?${new URLSearchParams({ ...filters, page: String(page - 1) })}`}
              className="rounded-full border px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Previous
            </a>
          )}
          <span className="rounded-full border bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/jobs?${new URLSearchParams({ ...filters, page: String(page + 1) })}`}
              className="rounded-full border px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Next
            </a>
          )}
        </div>
      )}
    </>
  )
}
