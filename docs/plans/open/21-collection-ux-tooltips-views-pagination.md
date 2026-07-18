# Plan 21 — Collection UX: tooltips, action rows, grid/table toggle, pagination & sorting

## Motivation

The collection screens (characters in the story flow, character library, stories,
templates, artifacts) have grown organically and show four recurring problems:

1. **Bare icon buttons.** Pencil, floppy-disk (save), and trash icons carry only
   an `aria-label`. Sighted users get no hint of what a button does until they
   click it.
2. **Inconsistent action layout.** Action icons appear ad hoc — some inline in a
   card header, some in `CardAction`, the rule list as one stacked row per rule.
   There is no shared pattern for "a horizontal cluster of actions that wraps."
3. **One view per screen.** Every collection is a card grid. Once a user has many
   items, a dense table with sortable columns is a better fit — but there is no
   table anywhere in the app (`src/components/ui/table.tsx` is unused).
4. **Unbounded lists.** Every list procedure (`story.list`, `template.list`,
   `library.characters.list`, `artifact.list`) returns _all_ rows with no
   `take`/`cursor`, and every screen renders all of them. Fine at 10 items,
   pathological at 500.

This plan fixes all four with small shared primitives, one new dependency, and a
uniform cursor-pagination contract from Prisma through tRPC to the UI.

## Current state (verified)

- **Icon-only buttons, all `aria-label`ed, none tooltipped:**
  - `src/components/characters/CharacterCard.tsx:62-87` — Pencil / Save / Trash2
  - `src/components/characters/RuleList.tsx:28-43` — Pencil / Trash2 per rule
  - `src/components/story/StoryList.tsx:77-86` — Trash2
  - `src/components/templates/TemplatesScreen.tsx:89-96` — Trash2
  - `src/components/pages/PageGrid.tsx:96-114` — ChevronUp / ChevronDown
  - `src/components/layout/AppHeader.tsx:29-33` — account-menu trigger
- **Tooltip usage today:** only `TaskStatusBadge` and the sidebar built-in. The
  primitive (`src/components/ui/tooltip.tsx`, Base UI) is ready; there is no
  app-level `TooltipProvider`.
- **Layouts:** all collections are `grid gap-4 md:grid-cols-2 …` card grids
  except `RuleList`, which is a single-column stack of full-width cards with
  trailing icons.
- **Data layer:** repo ports (`src/server/ports/repos.ts`) expose
  `listByUser`/`listByStory` returning `Promise<T[]>`; Prisma impls use
  `findMany` + `orderBy` but never `take`/`cursor`; the in-memory fake
  (`src/server/repos/memory.ts`) filters without sorting (`listByUser`,
  `memory.ts:69-73`) — it already diverges from Prisma's `createdAt desc`.
- **Client:** screens use `useSuspenseQuery`; no `useInfiniteQuery` anywhere.
- **E2E:** `stories/characters/library/template` specs select buttons by
  accessible name (`getByRole("button", { name: "Delete story" })`) — labels
  are load-bearing and must not change.

## Dependencies

- **New: `@tanstack/react-table`** — headless table logic (column defs, header
  rendering, manual sort state). This is shadcn's canonical DataTable
  foundation and the only new dependency. We use it in _manual_ mode: sorting
  and pagination happen on the server; the table never sorts client-side.
- Everything else is already installed: shadcn `tooltip`, `table`,
  `toggle-group`, `empty`, `spinner`; `@trpc/react-query` v11 with
  `useInfiniteQuery` support.

No other libraries are needed. (Deliberately _not_ adding `nuqs` or a
virtualizer — URL state is handled with plain `useSearchParams` if ever needed,
and paginated pages stay small enough not to need virtualization.)

---

## Part 1 — Tooltips on icon actions

### 1a. Provider

Mount `<TooltipProvider delay={300}>` once in the app shell provider stack
(wherever `ThemeProvider`/tRPC providers live), so individual usages don't each
need one and hover delay is consistent app-wide.

### 1b. `IconButton` primitive — `src/components/ui/icon-button.tsx`

One small composition component so icon actions are impossible to ship without
both an accessible name _and_ a visible tooltip:

```tsx
interface IconButtonProps extends React.ComponentProps<typeof Button> {
  /** Accessible name AND tooltip text. Required. */
  label: string
  side?: "top" | "bottom" | "left" | "right"
}

function IconButton({ label, side = "top", size = "icon", ...props }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button size={size} aria-label={label} {...props} />}
      />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
```

(Base UI composes via the `render` prop — verify against
`src/components/ui/tooltip.tsx` and the sidebar's existing tooltip usage for
the exact idiom.)

This is justified under `docs/styling.md`'s "repeated application semantics"
rule — it encodes the invariant _icon-only ⇒ labeled + tooltipped_, not a
Tailwind rename.

### 1c. Migrate every icon-only button

Replace `Button size="icon" aria-label=…` with `IconButton label=…` at all the
sites listed above, passing the **exact same label strings** so every E2E
`getByRole("button", { name })` selector keeps working. Labeled buttons
(Use template, Add character, Prev/Next) keep their text and get no tooltip.

Add tooltips (plain `Tooltip` composition, not `IconButton`) to any remaining
ambiguous affordances found during implementation — e.g. disabled generate
buttons explaining _why_ they're disabled — but don't tooltip self-explanatory
labeled buttons.

## Part 2 — Horizontal wrapping action rows

### 2a. Pattern, not component

A shared class recipe, applied consistently: action clusters are

```
flex flex-wrap items-center gap-1
```

right-aligned in headers/rows (`ml-auto` or `justify-end`), using
ghost-variant `IconButton`s. This stays colocated Tailwind (styling.md seam 3);
no `ActionRow` wrapper component — it would just rename three utilities.

### 2b. Refactor the offenders

- **`CharacterCard`** — the three header buttons are currently direct flex
  children of `CardHeader`, so on narrow cards they squeeze the title. Wrap
  them in a single `flex flex-wrap items-center gap-1 shrink-0` cluster
  (wrapping vertically only when truly out of room) and keep the min-w-0
  title block.
- **`RuleList`** — keep one rule per row (it's a text list, a grid gains
  nothing) but tighten each row: rule text `min-w-0 flex-1 truncate`, trailing
  wrap-safe action cluster. Reduce vertical padding so many rules scan as a
  compact list rather than a stack of cards — consider `Item` from
  `src/components/ui/item.tsx` instead of full `Card` per rule.
- **`TemplatesScreen` cards** — Use template / Edit / (header Delete) already
  use `flex flex-wrap gap-2`; align gap and ordering with the new pattern.
- **`PageGrid`** move buttons already follow the pattern; just swap to
  `IconButton`.

Consistency pass: same gap (`gap-1` for icon clusters, `gap-2` when mixing
labeled buttons), same alignment (trailing), same ghost variant, across all
cards.

## Part 3 — Grid/table view toggle + shared table logic

### 3a. Shared collection components — `src/components/collections/`

New folder (feature-level, not `ui/` — these encode app semantics):

- **`ViewToggle`** — a two-item `ToggleGroup` (icons `LayoutGridIcon`,
  `TableIcon`, each with tooltip "Grid view" / "Table view",
  `aria-label`s for E2E). Controlled component.
- **`useCollectionView(screenKey)`** — view mode state persisted to
  `localStorage` (`collection-view:<screenKey>`), defaulting to `grid`.
  SSR-safe (read in effect / `useSyncExternalStore`), per-screen key so the
  library can be a table while stories stay a grid.
- **`DataTable`** — thin wrapper over shadcn `table.tsx` +
  `@tanstack/react-table`: takes `columns: ColumnDef<T>[]`, `data`,
  `sort`/`onSortChange` (manual sorting — clicking a sortable header calls
  back up; the server does the actual ordering), and renders header sort
  indicators (ArrowUpDown / ArrowUp / ArrowDown), an `Empty` state, and a
  trailing actions column. Row click navigates where the grid card links.
- **`SortSelect`** (grid views) — a small `Select` ("Newest", "Oldest",
  "Name A–Z", …) driving the same sort state, since grids have no headers to
  click.
- **`LoadMoreButton`** — outline button, full-row/centered: "Show more"
  (with count remaining unknown, just the label + spinner while fetching);
  hidden when `hasNextPage` is false. Used by both views ("…more" for grids,
  a footer row/button under the table).

### 3b. Where the toggle applies

| Screen                    | Toggle?                                         | Table columns                                                    |
| ------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| Stories (`StoriesScreen`) | yes                                             | Title, Created, Updated, actions (Delete)                        |
| Templates                 | yes                                             | Title, Pages, Characters, Created, actions (Use / Edit / Delete) |
| Character library         | yes                                             | Avatar+Name, Role, Age, Created, actions (Edit / Delete)         |
| Artifacts                 | yes                                             | Thumb, Story, Type, Created, "Open original"                     |
| Characters in story flow  | **no** — small per-story set, rich card content | —                                                                |
| Page grid / rule list     | **no** — ordering is positional, not sortable   | —                                                                |

Grid card markup stays what it is today (extracted per-screen `*Card`
components); the table view reuses the same mutation handlers (delete dialog,
etc.) so behavior is identical in both views.

## Part 4 — Cursor pagination + sorting (DB-performant)

### 4a. Contract

Keyset (cursor) pagination — no `OFFSET`, so cost doesn't grow with page
depth. One shared shape in `src/lib/validation/` (zod):

```ts
listParams = z.object({
  limit: z.number().int().min(1).max(100).default(24),
  cursor: z.string().nullish(),          // opaque, server-issued
  sort: z.object({
    field: z.enum([...per-endpoint fields...]),
    dir: z.enum(["asc", "desc"]),
  }).optional(),                          // per-endpoint default, e.g. createdAt desc
})
// response
{ items: T[]; nextCursor: string | null }
```

The cursor is an opaque base64 of `{ v: <sort-field value>, id }` — the sort
value plus `id` tiebreaker, so pagination is stable under any sort and under
concurrent inserts. Implement encode/decode + comparator in a small pure
module (`src/server/repos/list-params.ts` or similar) with unit tests, shared
by Prisma and memory implementations.

### 4b. Repo ports

Extend `src/server/ports/repos.ts` with paged variants (keep the existing
unpaged methods where internal callers need full sets, e.g. PDF export):

```ts
StoryRepo.listByUserPaged(userId, kind, params): Promise<Page<Story>>
LibraryCharacterRepo.listByUserPaged(userId, params): Promise<Page<LibraryCharacter>>
```

- **Prisma impls:** `findMany` with `where` + keyset predicate
  (`{ OR: [{ field: { lt: v } }, { field: v, id: { lt: id } }] }` — direction
  per sort; Prisma's native `cursor` option only supports unique orderings, so
  the explicit predicate is the reliable route), `orderBy: [{ field }, { id }]`,
  `take: limit + 1` (the extra row detects `nextCursor`).
- **Memory impl:** same comparator from the shared module, then slice. This
  also **fixes the existing bug** that `memory.ts` `listByUser` doesn't sort —
  after this change both impls must sort identically, guarded by a parity test
  in `src/server/repos/memory.test.ts` (same fixture through both semantics).

### 4c. Indexes (migration — requires explicit approval)

One schema migration adding composite indexes matching the keyset order:

- `Story`: `@@index([userId, kind, createdAt, id])`, and
  `@@index([userId, kind, title, id])` if title sort ships
- `LibraryCharacter`: `@@index([userId, createdAt, id])`, plus name-sort index
  if shipped

Schema-only migration → normal verification (migrate status, generated client,
tests, build). Per project rules: prepare `db-migrate` against dev, **stop and
ask for a fresh `yes` before running it**; production `db-deploy` is a
separate, later approval.

### 4d. tRPC procedures

- `story.list`, `template.list`, `library.characters.list` take `listParams`
  and return `{ items, nextCursor }`.
- `template.list` keeps its per-template counts, computed only for the
  returned page (existing batched `listByStoryIds` over the page's ids).
- **`artifact.list`** paginates **by story** (cursor over the user's stories,
  `createdAt desc`), returning all artifacts of each included story — the
  aggregate has no single table to cursor over, and story-granularity keeps
  the existing batched child loading intact per page.
- `character.listForStory`, `rule.list`, page lists: unchanged (small,
  per-story, positional).

### 4e. Client

Switch the four screens to `useSuspenseInfiniteQuery` (tRPC v11 /
TanStack Query v5) with `getNextPageParam: (last) => last.nextCursor`.
`items = pages.flatMap(p => p.items)`. Sort state (from table header or
`SortSelect`) is part of the query key, so changing sort refetches from the
first page. Grid → `LoadMoreButton` as the "…more" affordance after the grid;
table → same button under the table. Deletion keeps the existing
invalidate-and-refetch flow (invalidate the infinite query).

Skeletons: keep `PageHeaderSkeleton` + existing card skeleton patterns; add a
table skeleton variant sharing row height with `DataTable`.

## Testing

- **Unit:** cursor encode/decode + comparator; repo parity test (Prisma
  semantics mirrored by memory impl over one fixture: sorting, tiebreaker,
  nextCursor edge cases — exact-page-size boundary, empty page, mid-list
  cursor after deletion).
- **Server:** router tests through `createTestCaller` + `inMemoryRepos` for
  each paged procedure (limit clamp, sort variants, cursor walk covering the
  full set without duplicates/gaps).
- **Component:** `IconButton` (renders aria-label, shows tooltip content),
  `DataTable` (sort callback, empty state), `useCollectionView` persistence.
- **E2E (all against fakes, per testing rules):**
  - existing specs must pass unchanged (labels preserved);
  - library spec: seed > 1 page of characters (page size can be overridden via
    a small `limit` default or by seeding 25+), click "Show more", assert the
    next page appears; toggle to table view, sort by name, assert order;
  - stories spec: grid/table toggle round-trip persists across reload.

## Sequencing (each lands as one worktree branch, in order)

1. **Tooltips + action rows** (Parts 1–2). Pure UI, no schema, no API change.
2. **Grid/table toggle + DataTable** (Part 3) with client-side data as-is
   (sorting still server-default order; headers not yet sortable, or
   client-sorted temporarily _only if trivial_— prefer waiting for step 3).
3. **Pagination + sorting** (Part 4): validation module, ports, both repo
   impls, migration (with approval gate), routers, then wire
   `useSuspenseInfiniteQuery`, `SortSelect`, sortable headers, `LoadMoreButton`
   into the step-2 components. E2E for load-more and sort.

Steps 1 and 2 are independently shippable; step 3 is the only one touching the
database and can be reviewed with the most care.

## Out of scope

- Numbered-page pagination UI (`src/components/ui/pagination.tsx` stays
  unused; keyset + load-more doesn't support jump-to-page).
- Virtualized lists, search/filtering (natural follow-ups on `DataTable`).
- Pagination inside a single story (pages, rules, per-story characters).
- Server-persisted view preference (localStorage is enough pre-production).
