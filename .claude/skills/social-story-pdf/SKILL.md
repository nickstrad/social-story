---
name: social-story-pdf
description: Combine the generated social-story page images into one shareable PDF in final_stories/, using the social-story tool. Use when the user says things like "make a pdf of the story", "combine the pages into a pdf", "export the book as a pdf", or "build the final story pdf".
---

# Build a whole-story PDF from the page images

Runs the `pdf` command of the local `social-story` Go tool. It collects the
already-generated page images (`page1.png`, `page2.png`, ...) in story page
order and lays them one-per-page into a single PDF, written to the
`final_stories/` folder at the project root. This is fully deterministic — it
does NOT call any AI model or cost anything; it only reads existing images.

## Steps

1. Work in the project root: `/Users/nick/Software/social-story`.
2. Find the story JSON that was used to generate the images (default to the most
   recent `*.json`, e.g. `social_story1.json`; ask if ambiguous).
3. Confirm the images exist in the output folder (default `images/`, files named
   `page<N>.png`). Pages whose image is missing are skipped with a notice.
4. Build the binary if missing/stale, then run:

   ```bash
   cd /Users/nick/Software/social-story
   go build -o social-story .
   ./social-story pdf <story.json> images
   ```

5. The PDF lands at `final_stories/<slug>.pdf`, where the slug is derived from
   the story title (falling back to the JSON file name). Each PDF page is sized
   to its image so nothing is cropped or distorted.
6. Report the output path and page count to the user.

## Notes

- Generate the pages first ([social-story-page]) and, if you want text on the
  pages, caption them ([social-story-caption]) BEFORE building the PDF — it
  reflects whatever is currently on disk.
- Re-running overwrites the same PDF (name is title-derived), so it is safe to
  rebuild after regenerating a page.
- Related skills: [social-story-json], [social-story-base], [social-story-page],
  [social-story-redo], [social-story-caption].
