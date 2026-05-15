# Design System

**Principle:** Material Design 3 (Material You) adapted for web — tonal surfaces, gentle elevation, expressive but calm. Pastel palette, rounded everything, happy vibe.

---

## Color palette

All colors defined as HSL CSS variables in `apps/web/app/globals.css`.

| Token | Light value | Usage |
|---|---|---|
| `--primary` | `258 60% 68%` — soft violet | Buttons, active states, links |
| `--primary-foreground` | `258 100% 98%` — near white | Text on primary |
| `--secondary` | `174 45% 88%` — pastel mint | Secondary buttons, chips |
| `--secondary-foreground` | `174 45% 20%` — dark teal | Text on secondary |
| `--accent` | `338 60% 88%` — pastel rose | Highlights, badges, tags |
| `--accent-foreground` | `338 60% 20%` — dark rose | Text on accent |
| `--background` | `248 30% 98%` — lavender-tinted white | Page background |
| `--card` | `0 0% 100%` — pure white | Card surfaces |
| `--muted` | `248 25% 94%` — light lavender | Muted backgrounds, inputs |
| `--muted-foreground` | `248 15% 50%` — medium slate | Secondary text |
| `--border` | `248 20% 88%` — soft lavender border | All borders |
| `--destructive` | `0 72% 65%` — pastel red | Errors, destructive actions |

### Status / semantic colours (for job status chips)

| Status | Color name | HSL |
|---|---|---|
| New | Pastel blue | `211 80% 78%` |
| Applied | Pastel green | `142 55% 72%` |
| Interviewing | Pastel amber | `38 85% 72%` |
| Offer | Pastel emerald | `160 60% 65%` |
| Rejected | Pastel gray | `220 15% 72%` |
| Dismissed | Pastel gray | `220 10% 80%` |

---

## Typography

- **Font:** System sans-serif stack — no Google Fonts to avoid GDPR/latency issues.
- **Scale:** Tailwind defaults (`text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`).
- **Headings:** `font-semibold` or `font-bold`, never all-caps.
- **Body:** `text-base font-normal`, line-height `leading-relaxed`.
- **Labels / captions:** `text-sm text-muted-foreground`.

---

## Spacing & layout

- **Page max-width:** `max-w-7xl mx-auto px-4`
- **Card padding:** `p-5` or `p-6`
- **Section gap:** `gap-6` or `gap-8`
- **Form field gap:** `space-y-4`
- **Inline element gap:** `gap-2`

---

## Border radius

Material Design 3 uses generous rounding.

| Element | Class |
|---|---|
| Buttons | `rounded-full` |
| Cards | `rounded-2xl` |
| Inputs | `rounded-xl` |
| Badges / chips | `rounded-full` |
| Dialogs / modals | `rounded-3xl` |
| Small tags | `rounded-md` |

---

## Elevation (shadows)

Soft, diffuse — not sharp drop shadows.

| Level | Class |
|---|---|
| Flat (default) | `shadow-none` with `border` |
| Card (resting) | `shadow-sm` |
| Card (hover) | `shadow-md` |
| Dropdown / popover | `shadow-lg` |
| Modal | `shadow-2xl` |

Cards use border + `shadow-sm` by default. On hover, transition to `shadow-md` with `transition-shadow duration-200`.

---

## Component patterns

### Buttons

```tsx
// Primary action
<Button className="rounded-full">Send magic link</Button>

// Secondary / outlined
<Button variant="outline" className="rounded-full">Cancel</Button>

// Destructive
<Button variant="destructive" className="rounded-full">Delete</Button>

// Icon button
<Button variant="ghost" size="icon"><IconName /></Button>
```

### Cards

```tsx
<div className="rounded-2xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
  {children}
</div>
```

Use shadcn `<Card>` only when you need the full Card/CardHeader/CardContent structure. For simple containers, use the raw `div` above.

### Status chips / badges

```tsx
// Job status
<span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[hsl(211,80%,93%)] text-[hsl(211,80%,30%)]">
  New
</span>
```

### Form inputs

```tsx
<Input className="rounded-xl" placeholder="Search jobs…" />
```

### Page header pattern

```tsx
<header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
  <div className="mx-auto max-w-7xl flex items-center justify-between px-4 h-14">
    <span className="font-semibold text-primary">Job Tracker</span>
    {/* nav items */}
  </div>
</header>
```

### Empty state pattern

```tsx
<div className="flex flex-col items-center justify-center py-20 text-center">
  <div className="rounded-full bg-muted p-4 mb-4">
    <IconName className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="font-semibold text-foreground mb-1">No jobs yet</h3>
  <p className="text-sm text-muted-foreground max-w-xs">
    Your matched jobs will appear here once the first ingest runs.
  </p>
</div>
```

---

## Tone & microcopy

- Friendly, not corporate. "We sent a magic link" not "Authentication email dispatched."
- Positive framing. "5 new matches" not "0 unread."
- Short labels. "Apply" not "Click here to apply."
- Use ellipsis (`…`) not `...` for loading states.

---

## What NOT to do

- No sharp corners (`rounded-none`, `rounded-sm` on cards).
- No pure black text — use `text-foreground` (`hsl(248 25% 12%)`).
- No harsh red for errors — use the pastel destructive token.
- No Google Fonts imports.
- No gradients unless specifically designed (check first).
- No inline styles — always use Tailwind classes or CSS variables.
- No shadows without a border on cards at rest.
