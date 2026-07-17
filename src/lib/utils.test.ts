import { expect, test } from "vitest"

import { cn } from "@/lib/utils"

test("still merges Tailwind's own scales", () => {
  expect(cn("p-2", "p-4")).toBe("p-4")
})

// These would silently keep both classes if the theme extension in cn() ever
// drifts from the token namespaces in src/styles/theme.css.
test.each([
  ["max-w-app", "max-w-form"],
  ["gap-page", "gap-page-relaxed"],
  ["text-page-title", "text-section-title"],
  ["p-app-gutter", "p-page-block"],
  ["tracking-tight", "tracking-title"],
  ["font-sans", "font-heading"],
  ["font-semibold", "font-title"],
])("the later of %s / %s wins", (first, second) => {
  expect(cn(first, second)).toBe(second)
})

test("keeps font-family and font-weight tokens apart", () => {
  expect(cn("font-heading", "font-title")).toBe("font-heading font-title")
})
