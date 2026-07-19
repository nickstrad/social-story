import { describe, expect, it } from "vitest"

import {
  decodeCursor,
  encodeCursor,
  paginateList,
  storyListParamsSchema,
} from "./listParams"

const rows = [
  { id: "b", title: "Beta", createdAt: new Date("2026-01-02T00:00:00Z") },
  { id: "c", title: "Alpha", createdAt: new Date("2026-01-01T00:00:00Z") },
  { id: "a", title: "Alpha", createdAt: new Date("2026-01-01T00:00:00Z") },
]

describe("list pagination", () => {
  it("roundtrips opaque cursors", () => {
    const cursor = encodeCursor(new Date("2026-01-01T00:00:00Z"), "row-id")
    expect(decodeCursor(cursor)).toEqual({
      v: "2026-01-01T00:00:00.000Z",
      id: "row-id",
    })
    expect(cursor).not.toContain("row-id")
  })

  it("sorts with an id tiebreaker and walks pages without duplicates", () => {
    const first = paginateList(rows, {
      limit: 2,
      sort: { field: "title", dir: "asc" },
    })
    expect(first.items.map((row) => row.id)).toEqual(["a", "c"])
    expect(first.nextCursor).not.toBeNull()

    const second = paginateList(rows, {
      limit: 2,
      cursor: first.nextCursor,
      sort: { field: "title", dir: "asc" },
    })
    expect(second.items.map((row) => row.id)).toEqual(["b"])
    expect(second.nextCursor).toBeNull()
  })

  it("handles exact boundaries, empty pages, and deletion after a cursor", () => {
    const exact = paginateList(rows.slice(0, 2), {
      limit: 2,
      sort: { field: "createdAt", dir: "desc" },
    })
    expect(exact.nextCursor).toBeNull()

    const first = paginateList(rows, {
      limit: 1,
      sort: { field: "createdAt", dir: "desc" },
    })
    const afterDeletion = paginateList(
      rows.filter((row) => row.id !== first.items[0]?.id),
      {
        limit: 10,
        cursor: first.nextCursor,
        sort: { field: "createdAt", dir: "desc" },
      }
    )
    expect(afterDeletion.items.map((row) => row.id).sort()).toEqual(["a", "c"])
    expect(
      paginateList([], {
        limit: 2,
        sort: { field: "createdAt", dir: "desc" },
      })
    ).toEqual({ items: [], nextCursor: null })
  })

  it("applies defaults and rejects malformed cursors", () => {
    expect(storyListParamsSchema.parse(undefined)).toMatchObject({
      limit: 20,
      sort: { field: "createdAt", dir: "desc" },
    })
    expect(() =>
      storyListParamsSchema.parse({ cursor: "not-a-cursor" })
    ).toThrow()
    expect(() =>
      storyListParamsSchema.parse({
        cursor: encodeCursor("not-a-date", "row-id"),
        sort: { field: "createdAt", dir: "desc" },
      })
    ).toThrow(/Cursor does not match the selected sort field/)
    expect(() =>
      storyListParamsSchema.parse({
        cursor: encodeCursor("not-a-date", "row-id"),
        sort: { field: "title", dir: "asc" },
      })
    ).not.toThrow()
  })
})
