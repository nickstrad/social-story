import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge only dedupes classes whose scale it knows. Without this the
// theme's named tokens look like unrelated classes, so `cn("max-w-app",
// "max-w-form")` would keep both and a caller's className could never override
// a component's variant. Keep in sync with the token namespaces in
// src/styles/theme.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      container: ["app", "content", "form"],
      spacing: [
        "app-header",
        "app-body",
        "app-gutter",
        "page-block",
        "page",
        "page-relaxed",
        "section",
        "field",
      ],
      text: ["page-title", "section-title"],
      "font-weight": ["title"],
      tracking: ["title"],
      font: ["heading"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
