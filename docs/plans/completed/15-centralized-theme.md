# Plan 15 — Centralized theme and semantic UI styling

**Depends on:** the current UI baseline, including the sidebar and artifacts page. Start implementation from the latest `main`. **Behavioral scope:** styling architecture only; no workflow, data, route, or copy changes.

## Goal

Make project-wide visual changes—font families, type scale, page widths, gutters, vertical rhythm, colors, radii, and shared control geometry—at a small number of intentional seams.

The project already has the right base: Tailwind CSS v4, shadcn `base-nova`, CSS color/radius variables, CVA variants, and `next/font`. Keep that stack. Do **not** add a theme library, CSS-in-JS runtime, a React theme provider, or a collection of exported class-name strings.

Use a three-layer system instead:

1. **Theme tokens** define project-wide visual values in one CSS file.
2. **Shared React primitives** own repeated semantic patterns and component-specific geometry.
3. **Feature components** compose those primitives and retain Tailwind utilities only for genuinely local layout.

This is preferable to common class constants because tokens remain runtime-tweakable, Tailwind can generate normal utilities from them, CVA preserves typed variants, and semantic React components keep markup/accessibility consistent.

## Current-state findings

- `src/app/globals.css` already centralizes semantic colors and radii, but mixes theme declarations with global base styles. Its `--font-sans: var(--font-sans)` mapping is self-referential instead of pointing at the `next/font` source variable.
- Page chrome is repeated throughout the app: `max-w-3xl/5xl/6xl`, `gap-6/8/10`, `text-3xl font-semibold tracking-tight`, and the header's `h-16`/`px-6` contract.
- The in-progress sidebar also needs the same header-height value and currently supplies it through an inline `style` object. That value belongs in the theme.
- shadcn primitives already centralize buttons, cards, fields, empty states, inputs, labels, and feedback. Feature code sometimes bypasses them with raw labels, error paragraphs, and dashed placeholders.
- Unique image grids, editor splits, aspect ratios, and responsive column counts are not theme concerns and should remain local utilities.

## 1. Establish the CSS-first theme

Create `src/styles/theme.css`, import it from `src/app/globals.css`, and move all theme values there. Keep Tailwind/package imports, the dark custom variant, and only global element resets in `globals.css`.

### Token contract

Expose the following named Tailwind v4 theme tokens with the current visual values as defaults:

| Concern               | Tailwind theme names                                        | Initial value / source   |
| --------------------- | ----------------------------------------------------------- | ------------------------ |
| Body font             | `--font-sans`                                               | `var(--font-geist-sans)` |
| Heading font          | `--font-heading`                                            | `var(--font-geist-sans)` |
| Monospace font        | `--font-mono`                                               | `var(--font-geist-mono)` |
| App container         | `--container-app`                                           | `72rem` (`max-w-6xl`)    |
| Content container     | `--container-content`                                       | `64rem` (`max-w-5xl`)    |
| Form/editor container | `--container-form`                                          | `48rem` (`max-w-3xl`)    |
| Header height         | `--spacing-app-header`                                      | `4rem`                   |
| Horizontal gutter     | `--spacing-app-gutter`                                      | `1.5rem`                 |
| Page block padding    | `--spacing-page-block`                                      | `1.5rem`                 |
| Standard page stack   | `--spacing-page`                                            | `1.5rem`                 |
| Relaxed page stack    | `--spacing-page-relaxed`                                    | `2rem`                   |
| Section stack         | `--spacing-section`                                         | `1rem`                   |
| Field stack           | `--spacing-field`                                           | `0.5rem`                 |
| Page title size       | `--text-page-title`, `--text-page-title--line-height`       | `1.875rem`, `2.25rem`    |
| Section title size    | `--text-section-title`, `--text-section-title--line-height` | `1.5rem`, `2rem`         |
| Title weight          | `--font-weight-title`                                       | `600`                    |
| Title tracking        | `--tracking-title`                                          | `-0.025em`               |

Continue to expose the existing semantic color tokens (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, borders/rings, charts, and sidebar) and radius scale. Keep light and dark values together in this file even though adding a user-facing theme switch is out of scope.

Do not replace Tailwind's global `--spacing` base. Named semantic spacing tokens avoid unintentionally resizing every shadcn control. Component-internal geometry remains centralized in that primitive's CVA definition; for example, button height changes belong in `button.tsx`, while app gutters belong in the theme.

Update `src/app/layout.tsx` so `next/font` only declares the source variables on `<html>`; `font-sans`/`font-heading`/`font-mono` resolve through the theme. Swapping the body or display font must then require only changing the font import/source mapping, not feature components.

## 2. Add semantic layout primitives

Add these components under `src/components/layout/`, built with `cn` and CVA and accepting `className` for local extensions:

### `PageLayout`

```ts
type PageLayoutProps = React.ComponentProps<"div"> & {
  width?: "form" | "content" | "app"
  spacing?: "standard" | "relaxed"
}
```

- Base: centered, full-width grid.
- `width`: maps to `max-w-form`, `max-w-content`, or `max-w-app`.
- `spacing`: maps to `gap-page` or `gap-page-relaxed`.
- Defaults: `width="content"`, `spacing="standard"`.
- Export `pageLayoutVariants` for the rare non-`div` consumer, following the existing `buttonVariants` pattern.

### `PageHeader`

```ts
type PageHeaderProps = React.ComponentProps<"div"> & {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  level?: 1 | 2
  size?: "page" | "section"
}
```

- Render a semantic `h1`/`h2` from `level`; derive `h1` for page size and `h2` for section size when it is omitted.
- `size="page"` uses the page-title tokens; `size="section"` uses section-title tokens.
- Render title and description as a grouped block, with optional actions in a wrapping, responsive flex header.
- Title uses `font-heading`, the title weight/tracking tokens, and no feature-owned font classes.
- Description uses semantic muted foreground; page descriptions remain base size and section descriptions remain small.
- Default to `size="page"`; an explicit `level` may override the size-derived heading level when the surrounding document hierarchy requires it.

Do not add generic `Stack`, `Box`, `Cluster`, or `Text` wrappers. They would merely rename Tailwind and make exceptions harder. `PageLayout` and `PageHeader` are warranted because they represent repeated application semantics.

## 3. Migrate app chrome and feature screens

Rebase from the latest `main` first so the sidebar/artifacts changes are included, then migrate in coherent groups:

- **App chrome:** replace duplicated header height, app width, gutters, and page padding in `AppShell`, `AppHeader`, `AppSidebar`, and `LandingHeader` with semantic token utilities. Remove the sidebar provider's inline `--header-height`; both header and sidebar must consume `--spacing-app-header`. Preserve the current sticky/off-canvas behavior and landmarks.
- **Route layouts:** use theme gutters and widths on the landing, auth, and protected layouts. The landing hero may retain its unique `py-24`, centered composition, and responsive headline scale.
- **Screen frames:** migrate story, character, page-editor, export, and artifact screens plus their skeletons to `PageLayout`. Use `form` for script/new/base/export, `content` for stories/characters/artifacts, and `app` for the page editor.
- **Headers:** replace repeated page/section heading markup with `PageHeader`, including action buttons where present. Preserve heading levels and visible copy.
- **Forms:** use the existing shadcn `Field`, `FieldLabel`, `FieldDescription`, and `FieldError` components in new-story, script, character, rule, and page metadata forms. Remove raw repeated `grid gap-2`, label, helper, and destructive-error class bundles where the Field API covers them.
- **Empty states and panels:** use the existing `Empty` family for feature-level empty states and `Card` for bordered content panels. Do not force image placeholders into `Empty` when they are fixed-ratio editor media; those remain local.
- **Shared primitives:** keep button/input/textarea/card dimensions in their existing component files. Replace a literal with a theme token only when it expresses a global semantic value; do not token-label every pixel.

After migration, feature components may still use utilities for responsive grids, media aspect ratios, positioning, truncation, local alignment, and state-specific styling. They should not repeat the canonical page widths, page title bundle, app gutter/header dimensions, field structure, or semantic colors as raw values.

## 4. Document and enforce the usage rules

Add a concise “UI styling system” section to `docs/00-overview.md`:

- Change project-wide values in `src/styles/theme.css`.
- Change a component family in its shadcn/CVA primitive.
- Use `PageLayout` and `PageHeader` for screen chrome.
- Use shadcn Field/Empty/Card/Button/etc. before creating feature-local equivalents.
- Keep one-off layout in colocated Tailwind utilities.
- Use semantic color names, never raw palette classes or literal colors in feature components.
- Add a token only when at least two consumers must change together or it represents a deliberate design-system control.

No lint plugin or new dependency is needed. Enforcement should rely on the small public styling API, code review, and focused component tests rather than brittle regex rules.

## Tests and verification

- Add React Testing Library tests for `PageLayout` variants/class merging and `PageHeader` heading level, size, description, actions, and caller-provided classes. Assert public behavior and semantic token classes, not the full internal class string.
- Update existing component tests only where the semantic markup changes; behavior and accessible names must remain unchanged.
- Run `npm run test:run`, `npm run lint`, `npm run format:check`, and `npm run build`.
- Run `npm run test:e2e` because this refactor crosses every UI flow. It must use the repository-owned port 3100 server and deterministic fakes; no external service calls.
- Manually inspect at 375px and 1440px widths: landing, sign-in/up, stories list/new, script, characters/rules, base image, pages grid/focus, export, artifacts, and sidebar open/closed/mobile states.
- Verify focus rings, label associations, heading hierarchy, empty states, skeleton dimensions, overflow, and dark token contrast.

## Acceptance criteria

- A body/display font swap is confined to the root font declaration/theme mapping; no feature component changes are required.
- App width, gutter, header height, page spacing, and canonical title styling each have one named theme control and no repeated literal contract in feature screens.
- Repeated screen chrome is rendered through `PageLayout`/`PageHeader`; forms and empty states use existing shadcn semantics.
- Unique layouts remain readable Tailwind rather than being hidden behind generic abstractions.
- The refactor is visually equivalent at default token values, introduces no runtime theme provider or dependency, and all unit/build/lint/E2E checks pass without real network access.

## Out of scope

- Choosing a new brand font, palette, or visual direction.
- Adding a light/dark/system preference toggle.
- A user-editable theme editor or persisted per-user themes.
- Storybook, visual-regression infrastructure, or replacing shadcn/Tailwind.
