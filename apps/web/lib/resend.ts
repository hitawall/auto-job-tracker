import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM ?? "Job Tracker <alerts@jobtracker.dev>"

interface AlertJob {
  title: string
  company: string
  location: string | null
  url: string
  score: number
  reasons: string[]
}

export async function sendJobAlert(to: string, jobs: AlertJob[]): Promise<boolean> {
  if (!resend) {
    console.warn("[resend] RESEND_API_KEY not set — skipping email")
    return false
  }

  const rows = jobs
    .map(
      (j) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">
        <a href="${j.url}" style="font-weight:600;color:#6d28d9;text-decoration:none">${j.title}</a><br>
        <span style="color:#6b7280;font-size:13px">${j.company}${j.location ? ` · ${j.location}` : ""}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:#7c3aed">${j.score}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#6b7280;font-size:12px">${j.reasons.join(", ")}</td>
    </tr>`,
    )
    .join("")

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111">
  <h2 style="color:#7c3aed;margin-bottom:4px">🎯 ${jobs.length} new job match${jobs.length === 1 ? "" : "es"} today</h2>
  <p style="color:#6b7280;margin-top:0">From your Job Tracker alert</p>
  <table style="width:100%;border-collapse:collapse;margin-top:16px">
    <thead>
      <tr style="background:#f5f3ff">
        <th style="padding:8px 12px;text-align:left;font-size:13px;color:#7c3aed">Job</th>
        <th style="padding:8px 12px;text-align:center;font-size:13px;color:#7c3aed">Score</th>
        <th style="padding:8px 12px;text-align:left;font-size:13px;color:#7c3aed">Why</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:24px;font-size:12px;color:#9ca3af">
    You're receiving this because you have email alerts enabled in
    <a href="${process.env.NEXT_PUBLIC_SITE_URL}/preferences" style="color:#7c3aed">your preferences</a>.
  </p>
</body>
</html>`

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `${jobs.length} new job match${jobs.length === 1 ? "" : "es"} for you`,
    html,
  })

  if (error) {
    console.error("[resend] send error", JSON.stringify(error))
    return false
  }
  return true
}
