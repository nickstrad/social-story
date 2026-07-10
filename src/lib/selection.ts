// Pure helpers for a multi-select set of page ids. Every operation returns a
// new Set so React state updates stay immutable and referentially honest.

export function toggle(selected: Set<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function selectAll(ids: string[]): Set<string> {
  return new Set(ids)
}

export function selectNone(): Set<string> {
  return new Set()
}

export function isAllSelected(selected: Set<string>, ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => selected.has(id))
}
