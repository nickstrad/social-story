"use client"

import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface IconButtonProps extends ComponentProps<typeof Button> {
  /** The required accessible name and visible tooltip text. */
  label: string
  side?: "top" | "bottom" | "left" | "right"
}

export function IconButton({
  label,
  side = "top",
  size = "icon",
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button size={size} aria-label={label} {...props} />}
      />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
