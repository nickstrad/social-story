"use client"

import { PencilIcon, Trash2Icon } from "lucide-react"
import { IconButton } from "@/components/ui/icon-button"
import { Item, ItemActions, ItemContent, ItemGroup } from "@/components/ui/item"
import { describeRule } from "@/lib/ruleText"
import type { ClientCharacter as Character, Rule } from "@/server/domain/types"

export function RuleList({
  rules,
  characters,
  onEdit,
  onDelete,
}: {
  rules: Rule[]
  characters: Character[]
  onEdit: (rule: Rule) => void
  onDelete: (rule: Rule) => void
}) {
  if (!rules.length)
    return <p className="text-sm text-muted-foreground">No visual rules yet.</p>
  return (
    <ItemGroup>
      {rules.map((rule) => (
        <Item key={rule.id} variant="outline" size="xs">
          <ItemContent className="min-w-0">
            <p className="truncate text-sm">{describeRule(rule, characters)}</p>
          </ItemContent>
          <ItemActions className="ml-auto flex-wrap gap-1">
            <IconButton
              variant="ghost"
              size="icon-sm"
              label="Edit rule"
              onClick={() => onEdit(rule)}
            >
              <PencilIcon />
            </IconButton>
            <IconButton
              variant="ghost"
              size="icon-sm"
              label="Delete rule"
              onClick={() => onDelete(rule)}
            >
              <Trash2Icon />
            </IconButton>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}
