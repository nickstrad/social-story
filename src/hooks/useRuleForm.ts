"use client"

import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ruleInputSchema } from "@/server/domain/schemas"
import type { Rule, RuleKind } from "@/server/domain/types"
import { useRules } from "./useRules"

export type RuleValues = {
  kind: RuleKind
  text: string
  characterIds: string[]
}
export function useRuleForm(storyId: string, rule?: Rule) {
  const { create, update } = useRules(storyId)
  const [values, setValues] = useState<RuleValues>(
    rule ?? { kind: "TOGETHER", text: "Appear together", characterIds: [] }
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const onChange = <K extends keyof RuleValues>(
    field: K,
    value: RuleValues[K]
  ) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors({})
  }
  async function onSubmit(event?: FormEvent) {
    event?.preventDefault()
    const parsed = ruleInputSchema.safeParse(values)
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors
      setErrors(
        Object.fromEntries(
          Object.entries(fields).map(([key, messages]) => [
            key,
            messages?.[0] ?? "Invalid value",
          ])
        )
      )
      return
    }
    try {
      const saved = rule
        ? await update.mutateAsync({
            storyId,
            ruleId: rule.id,
            rule: parsed.data,
          })
        : await create.mutateAsync({ storyId, rule: parsed.data })
      toast.success(rule ? "Rule updated" : "Rule added")
      return saved
    } catch (cause) {
      setErrors({
        form: cause instanceof Error ? cause.message : "Could not save rule",
      })
    }
  }
  return {
    values,
    errors,
    isSubmitting: create.isPending || update.isPending,
    onChange,
    onSubmit,
  }
}
