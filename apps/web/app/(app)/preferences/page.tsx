import { createClient } from "@/lib/supabase/server"
import { savePreferences } from "./actions"
import type { PreferenceRow } from "@repo/types"

export default async function PreferencesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = await supabase
    .from("preferences")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle()

  const pref = data as PreferenceRow | null

  const fieldClass =
    "w-full rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
  const labelClass = "block text-sm font-medium text-foreground mb-1"
  const hintClass = "text-xs text-muted-foreground mt-1"

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Preferences</h1>
        <p className="text-sm text-muted-foreground">
          Tell the match engine what you&apos;re looking for.
        </p>
      </div>

      <form action={savePreferences} className="space-y-6 max-w-2xl">
        <div className="rounded-2xl border bg-card p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Job targeting</h2>

          <div>
            <label className={labelClass}>Job titles</label>
            <input
              name="job_titles"
              defaultValue={pref?.job_titles?.join(", ") ?? ""}
              placeholder="Software Engineer, Product Manager, …"
              className={fieldClass}
            />
            <p className={hintClass}>Comma-separated. Title must match one of these.</p>
          </div>

          <div>
            <label className={labelClass}>Seniority</label>
            <input
              name="seniority"
              defaultValue={pref?.seniority?.join(", ") ?? ""}
              placeholder="Senior, Staff, Lead, …"
              className={fieldClass}
            />
            <p className={hintClass}>Comma-separated keywords matched against the job title.</p>
          </div>

          <div>
            <label className={labelClass}>Locations</label>
            <input
              name="locations"
              defaultValue={pref?.locations?.join(", ") ?? ""}
              placeholder="San Francisco, New York, London, …"
              className={fieldClass}
            />
            <p className={hintClass}>Ignored for fully remote roles.</p>
          </div>

          <fieldset>
            <legend className={labelClass}>Remote preference</legend>
            <div className="flex gap-4 mt-1">
              {(["remote", "hybrid", "onsite"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    name="remote_modes"
                    value={mode}
                    defaultChecked={pref?.remote_modes?.includes(mode) ?? false}
                    className="accent-primary"
                  />
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className={labelClass}>Minimum salary (USD / year)</label>
            <input
              type="number"
              name="min_salary_usd"
              defaultValue={pref?.min_salary_usd ?? ""}
              placeholder="120000"
              className={fieldClass}
            />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Keywords</h2>

          <div>
            <label className={labelClass}>Must-have keywords</label>
            <input
              name="keywords_must"
              defaultValue={pref?.keywords_must?.join(", ") ?? ""}
              placeholder="TypeScript, React, …"
              className={fieldClass}
            />
            <p className={hintClass}>All of these must appear in the job (title + description).</p>
          </div>

          <div>
            <label className={labelClass}>Block keywords</label>
            <input
              name="keywords_block"
              defaultValue={pref?.keywords_block?.join(", ") ?? ""}
              placeholder="PHP, C++, …"
              className={fieldClass}
            />
            <p className={hintClass}>Any match scores the job as 0 (hidden).</p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-4">Alerts</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="alert_email"
              defaultChecked={pref?.alert_email ?? true}
              className="accent-primary w-4 h-4"
            />
            <div>
              <p className="text-sm font-medium text-foreground">Email alerts</p>
              <p className="text-xs text-muted-foreground">
                Daily digest of new matches sent to your account email.
              </p>
            </div>
          </label>
        </div>

        <button
          type="submit"
          className="rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Save preferences
        </button>
      </form>
    </>
  )
}
