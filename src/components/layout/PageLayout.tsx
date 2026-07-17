import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const pageLayoutVariants = cva("mx-auto grid w-full", {
  variants: {
    width: {
      form: "max-w-form",
      content: "max-w-content",
      app: "max-w-app",
    },
    spacing: {
      standard: "gap-page",
      relaxed: "gap-page-relaxed",
    },
  },
  defaultVariants: {
    width: "content",
    spacing: "standard",
  },
})

type PageLayoutProps = React.ComponentProps<"div"> &
  VariantProps<typeof pageLayoutVariants>

/** The canonical screen frame: one of the theme's page widths, centered, with
 *  the theme's vertical rhythm between its children. */
export function PageLayout({
  className,
  width,
  spacing,
  ...props
}: PageLayoutProps) {
  return (
    <div
      className={cn(pageLayoutVariants({ width, spacing }), className)}
      {...props}
    />
  )
}

export { pageLayoutVariants }
