---
name: social-story-caption
description: Deterministically print each page's story text into a caption band on already-generated page images, using the social-story tool. Use when the user says things like "add the text to the images", "put captions on the pages", "add the words to page 3", or "caption the story images".
---

# Add text captions to social-story images

Runs the `caption` command of the local `social-story` Go tool. For each page in
the JSON it renders that page's exact `text` into a clean band BELOW the artwork
(freetype, consistent font/band, correct spelling every time). This is fully
deterministic — it does NOT call any AI model or cost anything, and it never
covers the illustration.

## When to use which

- If images are NOT generated yet: prefer generating with the `--caption` flag
  ([social-story-page]) so text is added in the same pass.
- If images already exist WITHOUT text: use this `caption` command to add it.

## Steps

1. Work in the project root: `/Users/nick/Software/social-story`.
2. Find the story JSON that was used to generate the images (default to the most
   recent `*.json`, e.g. `social_story1.json`; ask if ambiguous).
3. Confirm the images exist in the output folder (default `images/`, files named
   `page<N>.png`).
4. Build the binary if missing/stale, then run:

   ```bash
   cd /Users/nick/Software/social-story
   go build -o social-story .
   ./social-story caption <story.json> images
   ```

   Each `images/page<N>.png` is rewritten in place with the text band added.
5. Read/display a couple of captioned images so the user can confirm.

## Notes

- IMPORTANT: this overwrites the page images IN PLACE and is NOT idempotent —
  running it twice would stack two bands. Run it once on freshly generated
  (text-free) images. To redo, regenerate the image first
  ([social-story-page] / [social-story-redo]) then caption again.
- Caption styling (band color, font size) lives in `caption.go`.
- Related skills: [social-story-json], [social-story-base], [social-story-page],
  [social-story-redo].
