# social-story

Turn a plain-text social story into an illustrated picture book using OpenAI.

The illustrations are tuned for the intended reader: every image prompt is
wrapped with a fixed context describing a Black / African American family drawn
authentically, in a calm, uncluttered, unambiguous style appropriate for a
**7-year-old high-functioning autistic child**, with consistent character design
across all pages.

## Setup

You need exactly one thing: an OpenAI API key. Put it in a `.env` file at the
project root:

```
OPENAI_API_KEY=sk-...
```

That's all. The program automatically loads `.env` from the directory you run it
in — no other configuration or environment setup required. (A real environment
variable, if set, takes precedence over `.env`.)

Build the binary:

```bash
go build -o social-story .
```

## Personalizing with your own photos (optional)

Drop personal photos into a `photos/` folder at the project root, plus an
`index.md` (or `index.txt`) that describes what each one shows:

```
photos/
  index.md
  family.jpg
  daughter.jpg
  dad.jpg
```

`index.md` maps each file to a short description, for example:

```markdown
- `daughter.jpg` — our 7-year-old daughter, with two puff hairstyles.
- `family.jpg` — the whole family together.
```

Then, right before each page's image is generated, the tool runs an extra step:
it reads the page and the index and decides **whether any single photo fits that
page** — and if so, attaches exactly one as a reference so the illustration
resembles your real family.

- Works **with or without** photos. No `photos/` folder → plain illustrations.
- **At most one** photo per page, and **only when it makes sense**. Pages where
  no photo fits are generated with no attachment.
- Supported image types: `.png`, `.jpg`, `.jpeg`, `.webp`.
- If photos exist but there's no index file, personalization is skipped.

When a photo is attached you'll see a line like `attaching daughter.jpg (our
daughter)` in the output.

## Usage

There are three commands. `outDir` defaults to `./images`.

### 1. `parse` — text → JSON

Splits the story into pages and saves a structured JSON file. Each page gets the
words to print (`text`) and a scene description (`image_prompt`).

```bash
./social-story parse example_story.txt story.json
```

If you omit the output name it derives one from the input (`example_story.json`).

### 2. `base` — build the character-sheet anchor (recommended)

Generates one reusable "model sheet" of the whole family (all members standing
on a plain background, correct ages/genders) from your `photos/`, saved to
`character_base.png`. Every page you generate afterward attaches this sheet as a
**consistency anchor** so faces, proportions, and art style stay the same across
all pages — instead of each page drifting on its own.

```bash
./social-story base
```

- Run it once (it's its own command so you can inspect the result before
  generating pages). Re-run `base` any time you want a different look.
- If `character_base.png` doesn't exist, `generate`/`redo` still work — they just
  fall back to per-page generation with no anchor.
- Override the path with `--base path/to/sheet.png`.

### 3. `title` — build the book-cover page (optional)

Generates a cover illustration of the whole family into `images/title.png` and
prints the story's title (the JSON `title` field) on top as a deterministic
caption band. The `pdf` step automatically places this image first, before page
1, so the finished book has a proper cover.

```bash
./social-story title story.json images
./social-story title story.json images \
  --note "hold the country's flag, and a small map outline in the sky"
```

- Uses `character_base.png` as the consistency anchor (when present) so the cover
  family matches the rest of the book.
- The title words are rendered by the tool, not the image model, so spelling is
  always correct — the illustration deliberately leaves calm open space for them.
- To change the cover title, edit the `title` field in the JSON and re-run.
- `--note "..."` appends extra art direction to the cover scene (props, setting,
  themes — e.g. a flag, a map outline, landmarks). The words in your note are
  still not drawn as text; they only steer the illustration.

### 4. `generate` — JSON → images

Creates one PNG per page in the output folder, named after its page:
`page1.png`, `page2.png`, ...

```bash
./social-story generate story.json images
```

**Test before a full run.** Before generating every page (which makes many
image calls at once), validate the whole pipeline on a single page or a small
batch:

```bash
./social-story generate story.json images --page 1     # just page 1
./social-story generate story.json images --limit 3    # just the first 3 pages
```

`--page N` renders only that page; `--limit N` renders only the first N. Both
run the exact same steps as a full run — including the per-page photo pick — so
what you see is representative. When it looks right, drop the flag to generate
everything.

You can print the page text directly onto the images with `--caption` — it
renders each page's words deterministically into a band below the art (correct
spelling every time, no reliance on the image model):

```bash
./social-story generate story.json images --caption
```

#### Adding text to existing images (`caption`)

If you already generated images without `--caption` (or you regenerated a few
pages with `redo`, which doesn't caption), the standalone `caption` command adds
the text band to images already on disk:

```bash
./social-story caption story.json images                 # caption every page
./social-story caption story.json images --page 2,4,10   # only these pages
```

`--page` takes the same single/comma/range syntax as `redo` (e.g. `3`, `2,4,14`,
`2-5,9`). **Captioning is not idempotent** — each run appends another band — so
target only the pages that don't already have text (e.g. the ones you just
`redo`'d), rather than re-captioning the whole book.

### Choosing models (any command)

By default the tool uses **`gpt-5.6-terra`** for parsing/photo-selection and
**`gpt-image-2`** (best quality/likeness) for images. Override either per run
with `--chat-model` and `--image-model`:

```bash
# Cheap test run (swap in the mini image model)
./social-story generate story.json images --page 1 --image-model gpt-image-1-mini

# Final, high-quality run (defaults)
./social-story generate story.json images

# Use a cheaper parser
./social-story parse story.txt story.json --chat-model gpt-5.4-nano
```

The flags work on every command (`parse`, `base`, `generate`, `redo`). Each run
prints the models it used, e.g. `Models: chat=gpt-5.6-terra image=gpt-image-2`.

#### Image model options (`--image-model`)

Only the **`gpt-image-*`** models can attach your personal photos. DALL·E cannot.

| Model                     | Sizes                       | Quality           | Personal photos? | ~ Price/image | Notes                       |
| ------------------------- | --------------------------- | ----------------- | :--------------: | ------------- | --------------------------- |
| `gpt-image-2` _(default)_ | up to 3840px, many ratios   | low/med/high/auto |        ✅        | $0.005–$0.211 | Best quality & likeness     |
| `gpt-image-1.5`           | 1024², 1024×1536, 1536×1024 | low/med/high      |        ✅        | $0.009–$0.20  | Mid-tier                    |
| `gpt-image-1`             | 1024², 1024×1536, 1536×1024 | low/med/high      |        ✅        | $0.011–$0.25  |                             |
| `gpt-image-1-mini`        | 1024², 1024×1536, 1536×1024 | low/med/high      |        ✅        | $0.005–$0.052 | Cheapest — best for testing |
| `dall-e-3`                | 1024², 1024×1792, 1792×1024 | standard/hd       |        ❌        | ~$0.04–$0.12  | No reference-photo support  |
| `dall-e-2`                | 256², 512², 1024²           | —                 |    ✅ (mask)     | ~$0.016–$0.02 | Outdated, low quality       |

#### Chat model options (`--chat-model`)

Used for splitting the story into pages and picking a photo per page. This is a
fairly simple task, so cheaper/smaller models are perfectly fine. Prices below
are per 1M tokens (input/output), as of July 2026.

| Model                       | ~ Price (in/out per 1M) | Notes                                 |
| --------------------------- | ----------------------- | ------------------------------------- |
| `gpt-5.6-terra` _(default)_ | $2.50 / $15             | Current mid-tier; the tool's default  |
| `gpt-5.6-luna`              | $1 / $6                 | Cheaper 5.6 tier                      |
| `gpt-5.6-sol`               | $5 / $30                | Top 5.6 tier                          |
| `gpt-5.5`                   | $5 / $30                | Flagship                              |
| `gpt-5.4`                   | $2.50 / $15             | Production workhorse, 1M context      |
| `gpt-5.4-mini`              | $0.75 / $4.50           | Budget option                         |
| `gpt-5.4-nano`              | $0.20 / $1.25           | Cheapest/fastest — plenty for parsing |
| `gpt-4o`                    | ~$2.50 / $10            | Legacy, still available               |

> This task barely needs a flagship — `gpt-5.4-nano` will parse a story well for
> a fraction of the cost. Availability depends on your account.

> Model availability depends on your OpenAI account. The `gpt-image-*` models
> also require Organization Verification in the OpenAI developer console.

### 5. `redo` — regenerate one or more pages

Regenerates one or more pages referenced in the JSON as new variants, so you can
compare versions without overwriting anything. Each redo bumps a per-page integer
suffix: `page2_1.png`, `page2_2.png`, ... The page selector accepts a single
page, a comma list, or inclusive ranges. When you pass several pages they run
concurrently (up to `--concurrency`, default 10), so a batch takes about as long
as the slowest single page.

```bash
./social-story redo story.json 2 images              # one page
./social-story redo story.json 2,4,12,14,19 images   # several, run concurrently
./social-story redo story.json 2-5 images            # an inclusive range
```

### 6. `pdf` — combine the pages into one PDF

Assembles all the generated page images into a single, shareable PDF, written to
the `final_stories/` folder at the project root. Images are laid out one-per-page
in story order, each PDF page sized to its image so nothing is cropped. If a
cover image (`title.png`) exists in the output folder, it is placed first, before
page 1.

```bash
./social-story pdf story.json images
```

The output name is derived from the story title, e.g.
`final_stories/my-trip-to-the-dominican-republic.pdf`. This is deterministic and
free — it reads the existing images only and calls no AI model. Pages whose image
is missing are skipped with a notice. Generate (and optionally `title` and
`caption`) the pages first; the PDF reflects whatever is currently on disk.

## Typical workflow

```bash
./social-story parse    example_story.txt story.json   # 1. text -> JSON
./social-story base                                    # 2. build the character-sheet anchor
./social-story title    story.json images              # 3. build the cover page (optional)
./social-story generate story.json images --page 1     # 4. test one page
./social-story generate story.json images              # 5. generate all pages
./social-story redo     story.json 2 images            # 6. don't like page 2? make another
./social-story pdf      story.json images              # 7. combine pages -> final_stories/*.pdf
```

## Editing before you generate

The JSON is a plain, editable intermediate. Open `story.json` and tweak any
page's `text` or `image_prompt` before running `generate` or `redo` — that's the
easiest way to steer a specific page.

## Notes

- Default models: `gpt-5.6-terra` for parsing, `gpt-image-2` for images. Override
  per run with `--chat-model` / `--image-model` (see "Choosing models" above).
- `base` builds a character sheet (`character_base.png`) that's attached to every
  page as a consistency anchor. Regenerate it with `base` whenever you want a new
  look; delete it to fall back to per-page generation.
- Every image request also carries the shared audience/style context defined in
  `audienceContext` in `main.go` — edit it there to change the look of the whole
  book.
- Add `.env`, `images/`, and `final_stories/` to your `.gitignore`.
