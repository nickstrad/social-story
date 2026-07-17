# Batch `artifact.list`'s per-story fan-out

## Why this is a separate plan

`artifact.list` (added with the sidebar/artifacts page) reads every story a user
owns and then fans out four repo calls **per story**. The fix is not in the
router — it needs new methods on `Repos`, which means touching
`src/server/ports/repos.ts`, `src/server/repos/memory.ts`, and the Prisma repos.
Those are the same files the `codex/inngest-retry` branch rewrites, so doing it
on the sidebar branch would have manufactured a merge conflict for no reason.
Hence: do it here, after that branch's repo changes have landed.

Nothing about this is urgent — it is invisible at small story counts. It is
worth doing because `/artifacts` is user-facing and its cost scales with exactly
the thing successful users accumulate.

## The problem

`src/server/api/routers/artifact.ts`:

```ts
const stories = await ctx.deps.repos.stories.listByUser(ctx.session.user.id)
const sources = await Promise.all(
  stories.map((story) => loadStorySources(ctx.deps, story))
)
```

and `loadStorySources` issues four queries for one story:

```ts
const [characters, pages, pageImages, tasks] = await Promise.all([
  deps.repos.characters.listByStory(story.id),
  deps.repos.pages.listByStory(story.id),
  deps.repos.pages.listImagesByStory(story.id),
  deps.repos.tasks.listByStory(story.id),
])
```

That is **1 + 4N** queries. 20 stories → 81 queries per page load, unbounded
(`prismaStoryRepo.listByUser` has no `take`).

The `Promise.all` makes it worse under load rather than better: ~80 queries hit
the Prisma pool at once, well past the default connection limit, so they queue
in waves. Locally that is tens of milliseconds; against a pooled remote Postgres
at ~20-30ms RTT it is roughly `80 / 10 × 30ms ≈ 240ms` of pool-serialised round
trips to render a grid of thumbnails.

## The fix

Four relation-filtered queries instead — a constant 5 total, regardless of story
count. The precedent already exists one level down, in
`src/server/repos/prisma/page-repo.ts`:

```ts
listImagesByStory: (storyId) =>
  db.pageImage.findMany({ where: { page: { storyId } }, orderBy: { variant: "asc" } }),
```

The same shape generalises to a set of story ids via `in`.

### 1. `src/server/ports/repos.ts`

Add alongside the existing `listByStory` methods:

- `CharacterRepo.listByStoryIds(storyIds: string[]): Promise<Character[]>`
- `PageRepo.listByStoryIds(storyIds: string[]): Promise<Page[]>`
- `PageRepo.listImagesByStoryIds(storyIds: string[]): Promise<PageImage[]>`
- `TaskRepo.listByStoryIds(storyIds: string[]): Promise<Task[]>`

### 2. `src/server/repos/prisma/*.ts`

Each is a one-liner mirroring its `listByStory` sibling:

```ts
listByStoryIds: (storyIds) =>
  db.character.findMany({ where: { storyId: { in: storyIds } } }),

listImagesByStoryIds: (storyIds) =>
  db.pageImage.findMany({
    where: { page: { storyId: { in: storyIds } } },
    orderBy: { variant: "asc" },
  }),
```

Guard the empty case (`storyIds.length === 0`) or rely on `in: []` returning
nothing — either is fine, but be deliberate about it.

### 3. `src/server/repos/memory.ts`

Mirror the existing filters, e.g.:

```ts
async listByStoryIds(storyIds) {
  const wanted = new Set(storyIds)
  return [...characters.values()].filter((item) => wanted.has(item.storyId))
},
```

Keep `pages.listByStoryIds` sorted by `position`, matching `listByStory` — the
artifact labels read `page.position`.

### 4. `src/server/api/routers/artifact.ts`

Replace the fan-out with four calls, then group by `storyId` in memory and build
the same `StoryArtifactSources[]` the domain already consumes:

```ts
const stories = await ctx.deps.repos.stories.listByUser(ctx.session.user.id)
const storyIds = stories.map((s) => s.id)
const [characters, pages, pageImages, tasks] = await Promise.all([...])
// group each by storyId, then:
return collectArtifacts(stories.map((story) => ({ story, ... })))
```

Note `pageImages` group by the **page's** story, so build a
`pageId → storyId` map from `pages` first.

`src/server/domain/artifacts.ts` needs **no changes** — `collectArtifacts`
already takes `StoryArtifactSources[]`.

## Ownership

Do not lose the current guarantee. Ownership holds _by construction_: every id
in `storyIds` came from `stories.listByUser(session.user.id)`, so the `in`
filters cannot reach another user's rows. There is deliberately no
`assertStoryOwnership` per story, and none should be added — that would
reintroduce an N+1 of its own.

## Testing

`src/server/__tests__/artifacts.int.test.ts` needs no changes: it asserts on
`caller.artifact.list()` output, not on repo calls. If it still passes, the
refactor is behaviour-preserving — which is the point.

Worth adding: a case with **two** stories for one user, since the grouping logic
is the only genuinely new thing and a single-story fixture cannot catch a
mis-grouped join.

`e2e/specs/sidebar.spec.ts` covers the page end-to-end and should stay green.

## Not in scope

`story.get` does a similar per-story fan-out, but for one story, already
ownership-checked — it is 4 queries, not 4N. Leave it alone.
