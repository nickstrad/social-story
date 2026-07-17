# UI styling system

The stack is Tailwind CSS v4 + shadcn (`base-nova`) + CVA + `next/font`. There is
no theme library, no CSS-in-JS runtime, and no React theme provider — project-wide
visual changes happen at three seams, in this order of preference.

## The three seams

| To change…                                                     | Edit…                                          |
| -------------------------------------------------------------- | ---------------------------------------------- |
| A project-wide value (font, page width, gutter, rhythm, color) | `src/styles/theme.css`                         |
| A whole component family (button height, input padding)        | that primitive's CVA block in `components/ui/` |
| One screen's own layout                                        | Tailwind utilities, colocated in the component |

## 1. Theme tokens — `src/styles/theme.css`

The single home for global visual values. `globals.css` holds only the Tailwind
and package imports, the dark variant, and element resets.

Tokens are declared in a plain `@theme` block (not `@theme inline`) so they stay
in `:root` and remain tweakable at runtime. Colors and radii use `@theme inline`
because they alias the `:root`/`.dark` custom properties.

Tailwind generates ordinary utilities from each token:

| Token namespace                           | Names                                            | Utilities                       |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------- |
| `--font-*`                                | `sans`, `heading`, `mono`                        | `font-sans`, `font-heading`     |
| `--container-*`                           | `app` (72rem), `content` (64rem), `form` (48rem) | `max-w-app`, `max-w-content`    |
| `--spacing-app-*`                         | `app-header` (4rem), `app-gutter` (1.5rem)       | `h-app-header`, `px-app-gutter` |
| `--spacing-page*`                         | `page`, `page-relaxed`, `page-block`             | `gap-page`, `py-page-block`     |
| `--spacing-section/field`                 | `section` (1rem), `field` (0.5rem)               | `gap-section`, `gap-field`      |
| `--text-*-title`                          | `page-title`, `section-title`                    | `text-page-title`               |
| `--font-weight-title`, `--tracking-title` | `title`                                          | `font-title`, `tracking-title`  |

Fonts resolve through the `next/font` source variables (`--font-geist-sans`)
declared on `<html>` in `src/app/layout.tsx`. **A font swap touches only the font
import and that mapping — never a feature component.**

Do not redefine Tailwind's global `--spacing` base. Named semantic tokens exist
precisely so that changing an app gutter does not resize every shadcn control.

### Adding a token

Add one only when **at least two consumers must change together**, or it is a
deliberate design-system control. Do not token-label every pixel. Component-internal
geometry stays in that component's CVA block.

When you add or rename a token, update the `extendTailwindMerge` theme extension in
`src/lib/utils.ts`. `cn` can only dedupe scales it knows about; without the entry,
`cn("max-w-app", "max-w-form")` silently keeps both and callers cannot override a
variant. `src/lib/utils.test.ts` guards this.

## 2. Shared primitives

**`src/components/layout/`** owns repeated application semantics:

- **`PageLayout`** — the screen frame. `width="form" | "content" | "app"` and
  `spacing="standard" | "relaxed"`. Defaults to `content` / `standard`. Export
  `pageLayoutVariants` for non-`div` consumers (e.g. a `<form>` that _is_ the frame).
- **`PageHeader`** — `title`, optional `description` / `actions`, plus `size`
  (`page` | `section`) and an optional `level` override. `size` picks the type scale
  and, unless `level` says otherwise, the heading level.
- **`PageHeaderSkeleton`** — the loading stand-in for `PageHeader`. A screen picks
  bar widths; the height comes from the title token, so the skeleton and the real
  header cannot drift apart. Never hand-roll a title bar in a skeleton.

A screen's skeleton must use the same `PageLayout` frame as the screen it stands
in for. A mismatch shows up as a width jump on hydration.

**`src/components/ui/`** is shadcn. Reach for the existing primitive before writing
a feature-local equivalent:

- `Field` / `FieldLabel` / `FieldTitle` / `FieldDescription` / `FieldError` for all
  form structure. `FieldLabel` for a real `<label>` tied to one control; `FieldTitle`
  when naming a group (checkbox list, toggle group) that no `<label>` can point at.
- `Empty` (+ `EmptyHeader` / `EmptyTitle` / `EmptyDescription`) for empty states.
- `Card` for bordered content panels. `CardHeader` already lays out title,
  description, and a trailing `CardAction` — don't override it back to flex.

Do **not** add generic `Stack`, `Box`, `Cluster`, or `Text` wrappers. They rename
Tailwind and make exceptions harder. `PageLayout`/`PageHeader` earn their place by
encoding repeated _application_ semantics, not by wrapping a class.

## 3. Feature components

Compose the primitives; keep Tailwind utilities for genuinely local layout —
responsive grids, media aspect ratios, positioning, truncation, alignment, and
state-specific styling. The landing hero's `py-24` and responsive headline scale are
correctly local.

Feature components must **not** re-state:

- canonical page widths, app gutters, or the header height,
- the page-title class bundle,
- field structure (`grid gap-2` + raw `<label>` + destructive error `<p>`),
- semantic colors as raw palette classes or literal color values.

Always use semantic color names (`text-muted-foreground`, `bg-card`), never raw
palette classes (`text-gray-500`) or literals.

### Who owns width

`PageLayout` owns a screen's width. Two components deliberately self-constrain
instead, because they appear inside frames of differing widths and must stay
form-width regardless: `StoryStepsNav` and the `ExportPanel`/`BaseImagePanel`
cards. That is why `ScriptScreen` has no frame of its own — both its children
already carry one. If you add a component that self-constrains, say so in a
comment; the default is to let the frame decide.

## Enforcement

No lint plugin. The public styling API is small on purpose; enforcement is code
review plus the focused tests in `src/components/layout/*.test.tsx` and
`src/lib/utils.test.ts`.
