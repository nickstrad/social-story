"use client"

import type { ListSort } from "@/lib/validation/listParams"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface SortOption<Field extends string> {
  label: string
  sort: ListSort<Field>
}

const sortValue = <Field extends string>(sort: ListSort<Field>) =>
  `${sort.field}:${sort.dir}`

export function SortSelect<Field extends string>({
  value,
  options,
  onValueChange,
}: {
  value: ListSort<Field>
  options: readonly SortOption<Field>[]
  onValueChange: (value: ListSort<Field>) => void
}) {
  return (
    <Select
      value={sortValue(value)}
      onValueChange={(nextValue) => {
        const option = options.find(({ sort }) => sortValue(sort) === nextValue)
        if (option) onValueChange(option.sort)
      }}
    >
      <SelectTrigger aria-label="Sort collection">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={sortValue(option.sort)}
            value={sortValue(option.sort)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
