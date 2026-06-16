---
name: frontend-impl
description: |
  Activate this skill when:
  - Building DashboardOverview.tsx
  - Writing React/TypeScript code
  - Integrating with Living Apps API
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

# Frontend Implementation Skill

Build a **production-ready, domain-specific dashboard** as the app's primary workspace.

---

## Step 1: Analyze and Decide (MANDATORY — before any code)

Read `.scaffold_context` and `app_metadata.json`. Then write 1-2 sentences describing:

1. **What is the best UI paradigm for the user's core workflow?**
2. **Why is this the most natural way to interact with THIS data?**

Use this table to guide your choice:

| Data Nature | Best UI Paradigm |
|-------------|-----------------|
| Time-based / scheduled entries | Calendar, week planner, timeline |
| Status-based / workflow stages | Kanban board, progress pipeline |
| Quantitative / goal-tracking | Progress rings, gauges, trend charts |
| Hierarchical / categorized | Grouped sections, nested views |
| Sequential / step-by-step | Stepper, checklist, flow view |
| Relational / many linked items | Master-detail, linked cards |

Then implement immediately. No design_brief.md, no task lists, no planning documents.

---

## Step 2: Build DashboardOverview.tsx

**Mandatory sequence:**
1. **Read** `src/pages/DashboardOverview.tsx` using the Read tool
2. **Write** `src/pages/DashboardOverview.tsx` ONCE with the complete content

**NEVER use Bash (cat/echo/heredoc) for file operations.** If Read or Write fails, retry with the same tool.

## Step 3: Build

```bash
npm run build
```

Deployment is automatic — do NOT deploy manually. After build succeeds, STOP.

---

## What Is Pre-Generated (DO NOT touch!)

CRUD sub-pages, dialogs, routing, sidebar, shared components, and the design system are pre-generated.

**DO NOT touch:** index.css, CRUD pages, dialogs, App.tsx, PageShell.tsx, StatCard.tsx, ConfirmDialog.tsx, ChatWidget.tsx, useDashboardData.ts, enriched.ts, enrich.ts, formatters.ts, ai.ts.

**EDITABLE:** `src/config/ai-features.ts` — toggle `AI_PHOTO_SCAN['EntityName'] = true` to enable the "Foto scannen" button in that entity's create/edit dialog. Useful for entities where users may photograph documents, receipts, or business cards to auto-fill form fields.

`index.css` contains the shared design system (Plus Jakarta Sans, indigo palette, dark sidebar). All semantic tokens (`bg-primary`, `text-muted-foreground`, `bg-sidebar`, etc.) are ready to use. Do NOT edit index.css — use existing tokens in your components.

**Already available in DashboardOverview.tsx:**
- `useDashboardData()` — all entities loaded, lookup maps built, loading/error handled
- `enrichX()` — applookup fields resolved to display name strings
- `formatDate()`, `formatCurrency()` — locale-aware formatting
- Loading skeleton and error state with retry

**Lookup fields are `{ key, label }` objects** — `LivingAppsService` enriches them automatically. Access `.label` directly (e.g. `record.fields.kursart?.label`). No special formatters needed.

**AI utilities available in `src/lib/ai.ts`:**
- `chatCompletion()` — core LLM call
- `classify()` — auto-categorize text
- `extract()` — structured data from text
- `summarize()` — condense text
- `translate()` — translate text
- `analyzeImage()`, `extractFromPhoto()` — image analysis
- `analyzeDocument()` — PDF/document analysis
- `fileToDataUri()` — encode File for AI calls
- `safeJsonCompletion()`, `withRetry()` — error handling

---

## Dashboard = Primary Workspace, NOT Info Page

**The #1 mistake is building the dashboard as a passive info screen** (KPI cards + chart + recent activity). Users want to WORK with their data, not just look at it.

### The Core Interactive Component

Every dashboard needs ONE interactive component — the **reason users open the app**. This component:

- Takes up significant screen space (hero, not sidebar widget)
- Supports create, edit, delete directly (click empty slot → create dialog, click entry → edit)
- Shows data in its most natural form (the paradigm you chose in Step 1)
- Provides immediate visual feedback

The pre-generated CRUD list pages are a fallback. Users should do 90% of their work without leaving the dashboard.

**ALWAYS reuse pre-generated dialogs** — When the dashboard needs create/edit forms, import `{Entity}Dialog` from `@/components/dialogs/{Entity}Dialog`. Never build custom dialog forms from scratch — the pre-generated ones already have all field types, photo scan, validation, and applookup selects.

### Record-Detail Surfaces — HARD RULE

When your UI shows the details of ONE record (image preview, kanban card click, calendar event tap, custom workflow page, profile view), you MUST use the pre-built widget — never roll your own modal/sheet/drawer.

- ✅ **EVERY clickable record MUST open a `<RecordOverlay>` — no exceptions.** A table row, gallery tile, card, list item, calendar event or kanban card that represents a record MUST, on click, open an in-page `<RecordOverlay>` with the record's detail composition. A record click that does nothing, only selects, navigates away, or opens an ad-hoc inline panel is a BUG. Wire the `<RecordOverlay>` every time.
- ✅ **One click target per record tile.** Put the record's open-handler on the tile itself. Do NOT lay an `absolute inset-0` hover overlay with `pointer-events-auto` over a clickable tile — it swallows the click and the record won't open. Action buttons (edit/delete) go in a corner with `e.stopPropagation()`, they do not cover the whole tile.
- ❌ Do NOT build a custom `<div className="fixed inset-0 …">` overlay for record details.
- ❌ Do NOT repurpose shadcn `<Dialog>` for record-view (Dialog stays for forms/confirmations).
- ❌ Do NOT invent domain-named one-off components (`ImagePreview`, `BookingCard`, `OrderDetails`).
- ✅ Two surfaces, one composition: **route** (`{Entity}DetailPage.tsx`, pre-generated) and **overlay** (`RecordOverlay`, you instantiate). Customization happens via slots, never by replacing the shell.

```tsx
import {
  RecordView, RecordOverlay,
  RecordHeader, RecordKeyFacts, RecordSection, RecordField, RecordRelation, RecordTimeline,
  RecordAttachments,
  RecordViewSkeleton, RecordViewEmpty, RecordViewError,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
```

**Build a visual hierarchy — don't render every field with equal weight.** Pick the 1–3 fields that describe the record at a glance (a total, a status, a due date) and surface them prominently: `<RecordHeader>` badges/`meta`, a `<RecordKeyFacts items={[…]} />` strip right under the header, and/or `emphasis` on a key `<RecordField>`. The rest go in the normal `<RecordSection>` grid. **Pass `hideEmpty` on optional fields** so a sparse record doesn't render a wall of "—" — and only render a `<RecordSection>` if it has at least one non-empty field.

**Calculated values (totals, sums) — reuse the form's formulas, don't re-derive them by hand.** The same `computed` formulas the forms use live in `src/config/form-enhancements/{Entity}.ts`. Evaluate them read-only against a record with the exported `evalComputed` and surface the result (ideal as a `RecordKeyFacts` tile or an `emphasis` field) — that keeps the detail view's numbers identical to the form's.

```tsx
import { evalComputed } from '@/config/form-enhancements/types';
import { formEnhancements } from '@/config/form-enhancements/Auftraege';
import { formatCurrency } from '@/lib/formatters';

const brutto = evalComputed(formEnhancements.computed.bruttobetrag, r.fields, { lookupLists: {} });
//                                                            ^ pass { lookupLists: { feldKey: liste } } only if the formula pulls from an applookup
<RecordKeyFacts items={[
  { label: 'Gesamt (Brutto)', value: brutto != null ? formatCurrency(brutto) : '—' },
]} />
```

If `formEnhancements.computed` is empty for the entity, there's nothing to compute — skip it.

**Full API, all 5 ready-to-paste recipes (Person, Ticket, Media, Booking, Article), and the overlay-stack pattern are in the widget's file header — a single JSDoc docblock at the top of `src/components/widgets/RecordView.tsx`.** The very first time you compose a record-detail view on this build, run `Read('src/components/widgets/RecordView.tsx')` and read the docblock once. Every slot, every prop, every format, every recipe — it's all there. The Vite minifier strips JSDoc from the bundle, so docs are free at runtime.

**Zoom belongs on a DETAIL surface — the overlay's `media` slot — not on list tiles.** On a record's detail view use `MediaThumbnail` (click-to-zoom images, PDF preview, file download); a raw `<img>` there is a dead end the user can't enlarge. But a clickable list/gallery **tile is ONE click target → it opens the `<RecordOverlay>`**; its image is a **passive `<img className="object-cover">`**. Never nest a `MediaThumbnail` inside a clickable tile — it steals the click to open its own lightbox and fights the tile-open.

```tsx
import { MediaThumbnail, MediaLightbox, useMediaViewer } from '@/components/widgets/MediaViewer';

// Gallery TILE — passive preview; the tile's click opens the overlay:
<div onClick={() => overlay.replace(r)} className="cursor-pointer …">
  <img src={r.fields.bilddatei} alt={r.fields.titel} className="aspect-square w-full object-cover rounded-xl" />
</div>

// INSIDE the overlay (media slot) — here it's zoomable:
<RecordOverlay open … media={<MediaThumbnail src={r.fields.bilddatei} alt={r.fields.titel} className="w-full h-64 object-cover rounded-xl" />}>
```

Read the docblock at the top of `src/components/widgets/MediaViewer.tsx` for the gallery (prev/next) pattern.

### Anti-Slop Checklist (if ANY true, redesign!)

- Dashboard is a passive info page — only KPI cards and charts
- No domain-specific UI — uses generic list/table for core data
- All KPI cards look identical
- Layout is a boring 2x2 or 3x3 grid
- No clear hero element
- Colors are generic blue/green/red (use the pre-configured palette tokens instead)
- Dashboard could be for ANY app
- **Custom `<div className="fixed inset-0…">` modal/overlay for record details instead of `RecordOverlay`**
- **Hand-rolled `ImagePreview` / `BookingCard` / `OrderDetails` component that re-renders fields instead of composing `RecordOverlay`/`RecordView`**
- **Raw `<img>` on a DETAIL surface (overlay media slot / RecordHeader) instead of `MediaThumbnail` — there the user must be able to enlarge it. (On a clickable list/gallery tile a plain `<img>` is CORRECT — zoom lives inside the overlay, not on the tile.)**
- **A `MediaThumbnail` nested inside a clickable tile — its lightbox fights the tile's open-overlay click; the tile image must be a plain `<img>`**
- **A record (row/tile/card/event) whose click does nothing, only selects, or opens a hand-rolled panel instead of a `<RecordOverlay>`**
- **A hover overlay (`absolute inset-0` + `pointer-events-auto`) laid over a clickable tile — it eats the click; the record never opens**
- **Detail view is a flat wall of equal-weight fields, or rows of "—" for empty fields — use `RecordKeyFacts` + `emphasis` for hierarchy and `hideEmpty` to drop empties**

---

## Design Principles

### Theme

Font (Plus Jakarta Sans) and color palette (indigo accent, warm off-white base, dark sidebar) are pre-configured in `index.css`. Use existing semantic tokens — do NOT add custom CSS variables unless the dashboard requires truly app-specific values (e.g. `--calendar-slot-height`).

Create typography hierarchy through weight differences (font-300 vs font-700) and size jumps (text-2xl vs text-sm).

### Layout: Visual Interest Required

Every layout needs variation — size, weight, spacing, format, typography. If everything is the same size in identical cards, it's AI slop.

**Mobile:** Vertical flow, thumb-friendly, hero dominates first viewport.
**Desktop:** Use horizontal space, multi-column where appropriate. Action buttons (edit, delete, close) must always be visible — never hide them behind hover.

---

## Pre-Generated Component APIs (exact props — do NOT Read to check, do NOT guess)

**`{Entity}Dialog`** — always this exact interface:
```tsx
<KurseDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  onSubmit={async (fields) => { await LivingAppsService.createKurseEntry(fields); fetchAll(); }} // dialog closes itself on success
  defaultValues={editRecord?.fields}         // undefined = create, fields = edit
  dozentenList={dozenten}                    // list prop = {entityIdentifier}List — matches useDashboardData key exactly
  raeumeList={raeume}                        // dozenten → dozentenList, raeume → raeumeList (NOT dozentList/raumList)
  enablePhotoScan={AI_PHOTO_SCAN['Kurse']}   // import AI_PHOTO_SCAN from '@/config/ai-features'
  enablePhotoLocation={AI_PHOTO_LOCATION['Kurse']}  // import AI_PHOTO_LOCATION — extract GPS from photo EXIF for geo field auto-fill
/>
```

**Applookup `defaultValues` need full record URLs — NEVER raw IDs:**
```tsx
// ❌ WRONG — raw ID breaks the Select
defaultValues={{ kurs: selectedKursId }}

// ✅ CORRECT
import { APP_IDS } from '@/types/app';
import { createRecordUrl } from '@/services/livingAppsService';
defaultValues={{ kurs: createRecordUrl(APP_IDS.KURSE, selectedKursId) }}
```

**`StatCard`** — `icon` must be rendered JSX, NOT a component reference:
```tsx
// ✅ CORRECT
<StatCard title="Kurse" value="42" description="Gesamt" icon={<IconBook size={18} className="text-muted-foreground" />} />
// ❌ WRONG — causes runtime error
<StatCard icon={IconBook} />
```

**`ConfirmDialog`** — uses `onClose` (not `onCancel`):
```tsx
<ConfirmDialog
  open={!!deleteTarget}
  title="Eintrag löschen"
  description="Wirklich löschen?"
  onConfirm={handleDelete}
  onClose={() => setDeleteTarget(null)}
/>
```

## Critical Implementation Rules

### Import Hygiene
Only import what you use. TypeScript strict mode **errors on unused imports and variables**. Every `import`, prop, and const must be referenced. Double-check before running `npm run build`.

### Type Imports
```typescript
// ❌ WRONG
import { Workout } from '@/types/app';
// ✅ CORRECT
import type { Workout } from '@/types/app';
```

### extractRecordId Null Check
```typescript
const id = extractRecordId(record.fields.relation);
if (!id) return;
```

### Dates Without Seconds
```typescript
const dateForAPI = formData.date + 'T12:00'; // YYYY-MM-DDTHH:MM only
```

### Select Never Empty Value
```typescript
// ❌ <SelectItem value="">None</SelectItem>
// ✅ <SelectItem value="none">None</SelectItem>
```

---

## Completeness Checklist

### Core Component
- [ ] Interactive component implements the chosen UI paradigm
- [ ] Users can create, edit, delete directly from the dashboard
- [ ] Component takes significant screen space (hero element)

### Technical
- [ ] `npm run build` passes
- [ ] Empty state handled (loading/error are pre-generated)
- [ ] No hardcoded demo data
- [ ] Responsive: mobile and desktop layouts

---

## Living Apps API Reference

### Date Formats (STRICT!)

| Field Type | Format | Example |
|------------|--------|---------|
| `date/date` | `YYYY-MM-DD` | `2025-11-06` |
| `date/datetimeminute` | `YYYY-MM-DDTHH:MM` | `2025-11-06T12:00` |

NO seconds for `datetimeminute`!

### applookup Fields

Store full URLs: `https://my.living-apps.de/rest/apps/{app_id}/records/{record_id}`

```typescript
import { extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';

const recordId = extractRecordId(record.fields.category);
if (!recordId) return;

const data = { category: createRecordUrl(APP_IDS.CATEGORIES, selectedId) };
```

### API Response Format

Returns **object**, NOT array. Use `Object.entries()` to extract `record_id`.

---

## Data Access (pre-generated — do NOT rewrite)

All data fetching, lookup maps, and enrichment are pre-generated. In DashboardOverview.tsx:

```typescript
// Already in the skeleton — just use the data:
const { kurse, anmeldungen, dozentenMap, loading, error, fetchAll } = useDashboardData();
const enrichedKurse = enrichKurse(kurse, dozentenMap, raeumeMap);

// Lookup fields are pre-enriched { key, label } objects — access .label directly:
record.fields.kursart?.label           // → "Restorative"
record.fields.tags?.map(v => v.label)  // → ["Alpha", "Beta"]
```

For CRUD after user actions:

```typescript
const handleCreate = async (fields) => {
  await LivingAppsService.createKurseEntry(fields);
  fetchAll();
};

const handleDelete = async (id: string) => {
  await LivingAppsService.deleteKurseEntry(id);
  fetchAll();
};
```

## Chart Pattern (recharts)

```typescript
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <XAxis dataKey="name" stroke="var(--muted-foreground)" />
    <YAxis stroke="var(--muted-foreground)" />
    <Tooltip contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }} />
    <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={false} />
  </LineChart>
</ResponsiveContainer>
```

## Available Libraries

- **shadcn/ui** — all components in `src/components/ui/`
- **recharts** — LineChart, BarChart, PieChart, AreaChart
- **@tabler/icons-react** — icons (all prefixed with `Icon`, e.g. `IconPlus`, `IconMapPin`; use `stroke` not `strokeWidth`)
- **date-fns** — date formatting with `de` locale

## Formatting (pre-generated — just import)

```typescript
import { formatDate, formatCurrency } from '@/lib/formatters';

formatDate(record.fields.startdatum);     // "06.11.2025" or "Nov 6, 2025"
formatCurrency(record.fields.preis);      // "199,00 €" or "$199.00"
```
