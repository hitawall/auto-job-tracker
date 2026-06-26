"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Input } from "@/components/ui/input"

export function FilterBar() {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    next.delete("page")
    startTransition(() => router.push(`/jobs?${next.toString()}`))
  }

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <Input
        placeholder="Search title or keyword…"
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => update("q", e.target.value)}
        className="rounded-xl max-w-xs"
      />
      <Input
        placeholder="Location"
        defaultValue={params.get("location") ?? ""}
        onChange={(e) => update("location", e.target.value)}
        className="rounded-xl max-w-[160px]"
      />
      <select
        defaultValue={params.get("remote") ?? ""}
        onChange={(e) => update("remote", e.target.value)}
        className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Any location type</option>
        <option value="remote">Remote</option>
        <option value="hybrid">Hybrid</option>
        <option value="onsite">On-site</option>
      </select>
      <Input
        placeholder="Company"
        defaultValue={params.get("company") ?? ""}
        onChange={(e) => update("company", e.target.value)}
        className="rounded-xl max-w-[160px]"
      />
      <select
        defaultValue={params.get("since") ?? ""}
        onChange={(e) => update("since", e.target.value)}
        className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Any time</option>
        <option value="4">Last 4 hours</option>
        <option value="8">Last 8 hours</option>
        <option value="12">Last 12 hours</option>
        <option value="24">Last 24 hours</option>
        <option value="72">Last 3 days</option>
        <option value="168">Last 7 days</option>
        <option value="720">Last 30 days</option>
      </select>
    </div>
  )
}
