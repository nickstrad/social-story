import { z } from "zod"

export const sortDirections = ["asc", "desc"] as const
export type SortDirection = (typeof sortDirections)[number]

export interface ListSort<Field extends string> {
  field: Field
  dir: SortDirection
}

export interface ListParams<Field extends string> {
  limit: number
  cursor?: string | null
  sort: ListSort<Field>
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

type CursorValue = string | number | Date
type CursorPayload = { v: string | number; id: string }

const cursorPayloadSchema = z
  .object({
    v: z.union([z.string(), z.number()]),
    id: z.string().min(1),
  })
  .strict()

export function encodeCursor(value: CursorValue, id: string): string {
  const payload: CursorPayload = {
    v: value instanceof Date ? value.toISOString() : value,
    id,
  }
  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

export function decodeCursor(cursor: string): CursorPayload {
  return cursorPayloadSchema.parse(
    JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
  )
}

const cursorSchema = z
  .string()
  .min(1)
  .refine(
    (cursor) => {
      try {
        decodeCursor(cursor)
        return true
      } catch {
        return false
      }
    },
    { message: "Invalid cursor" }
  )

function isCanonicalDateCursorValue(value: string | number): value is string {
  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  )
}

export function createListParamsSchema<const Fields extends readonly string[]>(
  fields: Fields,
  defaultSort: ListSort<Fields[number]>,
  { dateFields = [] }: { dateFields?: readonly Fields[number][] } = {}
) {
  const schema = z
    .object({
      limit: z.number().int().min(1).max(100).default(20),
      cursor: cursorSchema.nullish(),
      sort: z
        .object({
          field: z.enum(fields),
          dir: z.enum(sortDirections),
        })
        .default(defaultSort),
    })
    .superRefine((value, ctx) => {
      if (!value.cursor || !dateFields.includes(value.sort.field)) return
      const cursorValue = decodeCursor(value.cursor).v
      if (!isCanonicalDateCursorValue(cursorValue)) {
        ctx.addIssue({
          code: "custom",
          path: ["cursor"],
          message: "Cursor does not match the selected sort field",
        })
      }
    })
  return schema.optional().transform((value) => schema.parse(value ?? {}))
}

export const storySortFields = ["createdAt", "updatedAt", "title"] as const
export type StorySortField = (typeof storySortFields)[number]
export const storyListParamsSchema = createListParamsSchema(
  storySortFields,
  {
    field: "createdAt",
    dir: "desc",
  },
  {
    dateFields: ["createdAt", "updatedAt"],
  }
)

export const libraryCharacterSortFields = ["createdAt", "name"] as const
export type LibraryCharacterSortField =
  (typeof libraryCharacterSortFields)[number]
export const libraryCharacterListParamsSchema = createListParamsSchema(
  libraryCharacterSortFields,
  { field: "createdAt", dir: "desc" },
  { dateFields: ["createdAt"] }
)

export const artifactSortFields = [
  "createdAt",
  "label",
  "storyTitle",
  "kind",
] as const
export type ArtifactSortField = (typeof artifactSortFields)[number]
export const artifactListParamsSchema = createListParamsSchema(
  artifactSortFields,
  { field: "createdAt", dir: "desc" },
  { dateFields: ["createdAt"] }
)

function compareValues(left: CursorValue, right: CursorValue): number {
  // Production text order follows the database collation. This deterministic
  // code-unit fallback is for the in-memory repository; keep parity fixtures
  // case-normalized unless the production collation is deliberately mirrored.
  const normalizedLeft = left instanceof Date ? left.toISOString() : left
  const normalizedRight = right instanceof Date ? right.toISOString() : right
  if (normalizedLeft < normalizedRight) return -1
  if (normalizedLeft > normalizedRight) return 1
  return 0
}

function compareTuples(
  leftValue: CursorValue,
  leftId: string,
  rightValue: CursorValue,
  rightId: string,
  direction: SortDirection
): number {
  const directionMultiplier = direction === "asc" ? 1 : -1
  const valueComparison = compareValues(leftValue, rightValue)
  if (valueComparison !== 0) return valueComparison * directionMultiplier
  return compareValues(leftId, rightId) * directionMultiplier
}

export function compareListItems<
  T extends { id: string },
  Field extends keyof T & string,
>(left: T, right: T, sort: ListSort<Field>): number {
  return compareTuples(
    left[sort.field] as CursorValue,
    left.id,
    right[sort.field] as CursorValue,
    right.id,
    sort.dir
  )
}

export function paginateList<
  T extends { id: string },
  Field extends keyof T & string,
>(values: Iterable<T>, params: ListParams<Field>): Page<T> {
  const sorted = [...values].sort((left, right) =>
    compareListItems(left, right, params.sort)
  )
  const cursor = params.cursor ? decodeCursor(params.cursor) : null
  const remaining = cursor
    ? sorted.filter(
        (item) =>
          compareTuples(
            item[params.sort.field] as CursorValue,
            item.id,
            cursor.v,
            cursor.id,
            params.sort.dir
          ) > 0
      )
    : sorted
  return pageOrderedList(remaining, params)
}

export function pageOrderedList<
  T extends { id: string },
  Field extends keyof T & string,
>(ordered: T[], params: ListParams<Field>): Page<T> {
  const items = ordered.slice(0, params.limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor:
      ordered.length > params.limit && last
        ? encodeCursor(last[params.sort.field] as CursorValue, last.id)
        : null,
  }
}
