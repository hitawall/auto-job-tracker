import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Job Tracker",
  description: "Find and apply to jobs before everyone else.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
