export default function AboutPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">About</h1>
        <p className="text-sm text-muted-foreground">How this tracker works</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-3">What is this?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A personal job tracker that automatically ingests fresh postings from ATS job boards,
            LinkedIn, Indeed, and company career pages every 4 hours — then emails you a curated
            digest of roles that match your preferences. No manual searching required.
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-3">Job sources</h2>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex gap-3">
              <span className="shrink-0 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-0.5 font-medium h-fit">ATS feeds</span>
              <span>Greenhouse, Lever, Ashby, Workable — hundreds of companies publish open job feeds that are scraped directly via their APIs. No login required.</span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-0.5 font-medium h-fit">JobSpy</span>
              <span>LinkedIn and Indeed listings for India (Bengaluru, Mumbai, Hyderabad, Pune, Delhi NCR) scraped via python-jobspy every 4 hours.</span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-0.5 font-medium h-fit">Watchlist</span>
              <span>Companies you add to your Watchlist are scraped directly. The tracker auto-detects the ATS (Greenhouse, Lever, etc.) or uses Playwright to render JS-heavy career pages and extract job listings.</span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-0.5 font-medium h-fit">RemoteOK / HN</span>
              <span>Remote-friendly and startup listings from RemoteOK and Hacker News "Who's Hiring" threads.</span>
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-3">Ingest schedule</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Jobs are refreshed at <strong className="text-foreground">03:00, 07:00, 11:00, 15:00, 19:00, and 23:00 UTC</strong> every day.
            That is every 4 hours — use the "Last 4 hours" filter on the Jobs page to see exactly
            what arrived in the most recent batch.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
            Postings older than <strong className="text-foreground">30 days</strong> are automatically removed on each ingest run.
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-3">Email alerts</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Turn on email alerts in{" "}
            <a href="/preferences" className="text-primary underline underline-offset-2 hover:opacity-70">
              Preferences
            </a>
            . After each ingest run, every new job is scored against your preferences (job titles,
            location, remote mode, keywords, seniority). Roles scoring above 30/100 are bundled
            into a single digest email so your inbox doesn't get spammed.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
            You only get an email when there are new matches since your last alert — no email means
            nothing new matched.
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-3">Watchlist tips</h2>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>Paste the direct career URL (e.g. <code className="bg-muted px-1 rounded text-xs">boards.greenhouse.io/rippling</code>) for fastest ingestion via the ATS API.</li>
            <li>Pasting the company's own career page (e.g. <code className="bg-muted px-1 rounded text-xs">rippling.com/careers</code>) works too — the tracker will auto-detect the underlying ATS and switch to the API automatically after the first scrape.</li>
            <li>You can pause a company temporarily without deleting it.</li>
          </ul>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-3">Roadmap</h2>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="text-green-500 font-medium">✓</span>
              <span>Auth, dashboard, job ingestion, email alerts</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500 font-medium">✓</span>
              <span>Preferences + scoring engine + watchlist + Playwright portal scraping</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground/40 font-medium">○</span>
              <span className="text-muted-foreground/60">Resume upload + ATS-optimised variants (BYOK LLM)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground/40 font-medium">○</span>
              <span className="text-muted-foreground/60">WhatsApp / Telegram alerts</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground/40 font-medium">○</span>
              <span className="text-muted-foreground/60">Application kanban tracker</span>
            </li>
          </ul>
        </section>
      </div>
    </>
  )
}
