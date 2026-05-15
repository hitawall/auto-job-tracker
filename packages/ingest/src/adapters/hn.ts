import type { NormalizedJob } from "@repo/types"
import { inferRemote } from "../normalize"

interface AlgoliaHit {
  objectID: string
  story_id?: number
  story_title?: string
  comment_text?: string
  created_at?: string
  author?: string
}

interface AlgoliaStory {
  hits: Array<{ objectID: string; title?: string }>
}

interface AlgoliaComments {
  hits: AlgoliaHit[]
}

// Parses the first line of an HN "Who is Hiring" comment.
// Format (loose): "Company | Role | Location | ..."
function parseComment(
  comment: AlgoliaHit,
  storyId: string,
): NormalizedJob | null {
  const text = comment.comment_text ?? ""
  const firstLine = text.split(/\n/)[0] ?? ""
  const parts = firstLine.split("|").map((s) => s.replace(/<[^>]+>/g, "").trim())
  const company = parts[0]
  const title = parts[1]
  if (!company || !title) return null

  const locationHint = parts.slice(2).join(" ")
  return {
    source: "hn",
    source_job_id: comment.objectID,
    title: title.slice(0, 200),
    company: company.slice(0, 100),
    location: parts[2] ?? null,
    remote: inferRemote(locationHint),
    posted_at: comment.created_at ?? null,
    url: `https://news.ycombinator.com/item?id=${storyId}#${comment.objectID}`,
    description_md: text.slice(0, 5000),
    raw_payload: comment as Record<string, unknown>,
  }
}

export async function hn(): Promise<NormalizedJob[]> {
  try {
    // Find the latest "Ask HN: Who is Hiring?" story
    const storyRes = await fetch(
      "https://hn.algolia.com/api/v1/search?query=Ask+HN+Who+is+hiring&tags=story&restrictSearchableAttributes=title&hitsPerPage=1",
    )
    if (!storyRes.ok) return []
    const storyData = (await storyRes.json()) as AlgoliaStory
    const storyId = storyData.hits[0]?.objectID
    if (!storyId) return []

    // Fetch top-level comments (direct replies to the story)
    const commentsRes = await fetch(
      `https://hn.algolia.com/api/v1/search?tags=comment,story_${storyId}&hitsPerPage=200`,
    )
    if (!commentsRes.ok) return []
    const commentsData = (await commentsRes.json()) as AlgoliaComments

    return commentsData.hits
      .map((c) => parseComment(c, storyId))
      .filter((j): j is NormalizedJob => j !== null)
  } catch {
    return []
  }
}
