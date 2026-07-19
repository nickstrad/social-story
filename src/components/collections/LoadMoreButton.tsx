"use client"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function LoadMoreButton({
  hasNextPage,
  isFetchingNextPage,
  onClick,
}: {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onClick: () => void
}) {
  if (!hasNextPage) return null
  return (
    <div className="flex justify-center">
      <Button variant="outline" disabled={isFetchingNextPage} onClick={onClick}>
        {isFetchingNextPage && <Spinner />}
        Show more
      </Button>
    </div>
  )
}
