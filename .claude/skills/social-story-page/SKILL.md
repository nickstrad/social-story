---
name: social-story-page
description: Generate the illustration for one page (or a range, or all pages) of a social story using the social-story tool. Use when the user says things like "make image for page 1", "generate page 3", "make the first 5 pages", or "generate all the pages".
---

# Generate social-story page image(s)

Runs the `generate` command of the local `social-story` Go tool, which reads the
page JSON and produces one PNG per page into an output folder. It attaches the
`character_base.png` anchor (if present) plus at most one fitting personal photo,
so pages stay visually consistent and personalized.

## Steps

1. Work in the project root: `/Users/nick/Software/social-story`.
2. Find the story JSON. Default to the most recent `*.json` (e.g.
   `social_story1.json`); if ambiguous, ask which one.
3. Determine scope from the request:
   - **one page** ("page 1") -> add `--page 1`
   - **first N pages** ("first 3 pages") -> add `--limit 3`
   - **all pages** ("generate everything") -> no scope flag
4. Decide on captions: if the user wants the page text printed on the image, add
   `--caption` (renders the text deterministically into a band below the art).
   Otherwise leave it off for text-free illustrations.
5. Build the binary if missing/stale, then run:

   ```bash
   cd /Users/nick/Software/social-story
   go build -o social-story .
   ./social-story generate <story.json> images --page <N>      # one page
   # or: ./social-story generate <story.json> images --limit <N>
   # or: ./social-story generate <story.json> images           # all pages
   # add --caption to any of the above to print the page text on the image
   ```

   Output files land in `images/` as `page<N>.png`.
6. Read/display the generated image(s) so the user can review them.

## Notes

- When more than one page is generated, they run concurrently (default up to 10
  at once; image + caption per page), so a full run takes about as long as the
  slowest page rather than the serial sum. Log lines are grouped per page.
  Adjust with `--concurrency N`; lower it if the API returns rate-limit (429)
  errors. Transient 429/5xx failures auto-retry (default 3, tune with
  `--retries N`).
- Image model defaults to `gpt-image-2` (best). For a cheap test add
  `--image-model gpt-image-1-mini`.
- Before a big full run, suggest testing with `--page 1` first — a full book is
  many image calls.
- If `character_base.png` is missing, suggest running the base step first
  ([social-story-base]) for cross-page consistency.
- To make an ALTERNATE version of a page you already generated, use the redo
  step instead ([social-story-redo]).
- To add page text to images you already generated (without `--caption`), use
  the caption step ([social-story-caption]).
- Related skills: [social-story-json], [social-story-base], [social-story-redo],
  [social-story-caption].
