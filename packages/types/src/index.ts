import { z } from "zod"

export const JobSource = z.enum([
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "remoteok",
  "hn",
  "linkedin",
  "portal",
  "indeed",
  "glassdoor",
  "zip_recruiter",
  "google",
])
export type JobSource = z.infer<typeof JobSource>

export const RemoteMode = z.enum(["remote", "hybrid", "onsite", "unknown"])
export type RemoteMode = z.infer<typeof RemoteMode>

export const JobStatus = z.enum([
  "new",
  "seen",
  "dismissed",
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
])
export type JobStatus = z.infer<typeof JobStatus>

export const NormalizedJob = z.object({
  source: JobSource,
  source_job_id: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().nullable(),
  remote: RemoteMode,
  posted_at: z.string().datetime().nullable(),
  url: z.string().url(),
  description_md: z.string().nullable(),
  raw_payload: z.record(z.unknown()),
})
export type NormalizedJob = z.infer<typeof NormalizedJob>

export const Preference = z.object({
  user_id: z.string().uuid(),
  job_titles: z.array(z.string()),
  locations: z.array(z.string()),
  remote_modes: z.array(RemoteMode),
  min_salary_inr: z.number().int().nullable(),
  keywords_must: z.array(z.string()),
  keywords_block: z.array(z.string()),
  seniority: z.array(z.string()),
})
export type Preference = z.infer<typeof Preference>

export const PreferenceRow = Preference.extend({
  alert_email: z.boolean(),
  last_alert_sent_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime(),
})
export type PreferenceRow = z.infer<typeof PreferenceRow>
