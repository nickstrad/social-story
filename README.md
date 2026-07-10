# social-story

Turn a plain-text social story into a personalized, illustrated picture book using OpenAI.

This repo is mid-conversion from a Go CLI to a web app:

- **`cli/`** — the working Go CLI (the current, usable tool).
- **Repo root** — a Next.js 16 scaffold plus a full set of implementation plans in [`docs/`](docs/) for the web version. The web app itself is not built yet.

## The web app (planned)

The planned UX: sign in, paste a social-story script, upload photos of the people who should appear (with metadata and rules like "the siblings always appear together"), generate a character reference sheet for visual consistency, then generate an illustration per page — with editable text, extra steering prompts, regeneration variants, and add/remove/hide/reorder — before exporting the finished book as a PDF. Image generation runs as background tasks so the UI never blocks.

The build is specified as self-contained plans in [`docs/`](docs/): start with [`docs/00-overview.md`](docs/00-overview.md) (architecture, conventions, dependency graph), then plans `01`–`12` in dependency order. Planned stack: Next.js 16 (App Router), tRPC v11, Prisma → Neon Postgres, Better Auth, Vercel Blob, Inngest, sharp, pdf-lib.

What exists at the root today:

- Next.js 16 + TypeScript + Tailwind CSS 4 scaffold (`src/app/`)
- shadcn/ui component set (`src/components/ui/`)
- Vitest + React Testing Library configured (`vitest.config.mts`, `vitest.setup.ts`)
- Prettier + husky/lint-staged pre-commit hooks

```bash
npm install
npm run dev     # scaffold at http://localhost:3000
npm test        # vitest
```

## The Go CLI (working today)

Lives in `cli/`. It parses a story into pages, optionally personalizes illustrations with your own photos, keeps characters consistent via a generated character sheet, captions pages deterministically, and assembles a PDF.

Setup — one OpenAI API key in `cli/.env`:

```
OPENAI_API_KEY=sk-...
```

Build and run:

```bash
cd cli
go build -o social-story .

./social-story parse    example_story.txt story.json   # 1. text -> JSON pages
./social-story base                                    # 2. character-sheet anchor from photos/
./social-story title    story.json images              # 3. cover page (optional)
./social-story generate story.json images --page 1     # 4. test one page
./social-story generate story.json images              # 5. generate all pages
./social-story redo     story.json 2 images            # 6. regenerate page 2 as a variant
./social-story pdf      story.json images              # 7. combine -> final_stories/*.pdf
```

Personalization: put photos in `cli/photos/` with an `index.md` describing each one; the tool attaches at most one fitting photo per page. Commands accept `--chat-model` / `--image-model` overrides (defaults: `gpt-5.6-terra` chat, `gpt-image-2` images; only `gpt-image-*` models support reference photos). See the usage header in `cli/main.go` for the full reference, including `caption` and page-range syntax.
