"use client"

import { PencilIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
    <div className="grid gap-2">
      {rules.map((rule) => (
        <Card key={rule.id}>
          <CardContent className="flex items-center gap-3 py-3">
            <p className="flex-1 text-sm">{describeRule(rule, characters)}</p>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit rule"
              onClick={() => onEdit(rule)}
            >
              <PencilIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete rule"
              onClick={() => onDelete(rule)}
            >
              <Trash2Icon />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
