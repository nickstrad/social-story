import { cn } from "@/lib/utils"

type PageHeaderProps = React.ComponentProps<"div"> & {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  level?: 1 | 2
  size?: "page" | "section"
}

/** A titled screen or section header. `size` picks the type scale and, unless
 *  `level` overrides it, the heading level that normally goes with it. */
export function PageHeader({
  className,
  title,
  description,
  actions,
  level,
  size = "page",
  ...props
}: PageHeaderProps) {
  const isPage = size === "page"
  const Heading = `h${level ?? (isPage ? 1 : 2)}` as const

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-section",
        className
      )}
      {...props}
    >
      <div className="grid gap-field">
        <Heading
          className={cn(
            "font-heading font-title tracking-title",
            isPage ? "text-page-title" : "text-section-title"
          )}
        >
          {title}
        </Heading>
        {description && (
          <p
            className={cn(
              "text-muted-foreground",
              isPage ? "text-base" : "text-sm"
            )}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
