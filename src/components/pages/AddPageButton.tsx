"use client"

import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function AddPageButton({
  onAdd,
  label = "Add page",
}: {
  onAdd: () => void
  label?: string
}) {
  return (
    <Button variant="outline" size="sm" onClick={onAdd}>
      <PlusIcon />
      {label}
    </Button>
  )
}
