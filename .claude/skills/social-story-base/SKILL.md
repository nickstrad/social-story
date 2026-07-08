---
name: social-story-base
description: Build the reusable character-sheet anchor image for the social-story tool from the photos/ folder. Use when the user says things like "generate the base image", "make the character sheet", "build the base image from that json data", "regenerate the base", or wants a consistent family reference for the book.
---

# Build the character-sheet base image

Runs the `base` command of the local `social-story` Go tool. It generates one
reusable "model sheet" of the whole family (all members standing on a plain
background, correct ages/genders) from the reference photos in `photos/`, saved
to `character_base.png`. Later `generate`/`redo` runs attach this sheet as a
consistency anchor so characters stay the same across every page.

## Important clarification

The base image is built from the **`photos/` folder** (real family photos + its
`index.md`), NOT from the story JSON. If the user says "make the base from that
json data," gently note that the base comes from `photos/`; the JSON is only used
later, per page. No JSON argument is needed for this command.

## Steps

1. Work in the project root: `/Users/nick/Software/social-story`.
2. Confirm `photos/` exists with an `index.md` and at least one image. If not,
   tell the user the base will be generic without reference photos.
3. Build the binary if missing/stale, then run base:

   ```bash
   cd /Users/nick/Software/social-story
   go build -o social-story .
   ./social-story base
   ```

4. Read/display the resulting `character_base.png` so the user can eyeball it.
   If they don't like it, re-run `base` (it overwrites) or adjust
   `photos/index.md` / the `audienceContext` cast block in `main.go` first.

## Notes

- Image model defaults to `gpt-image-2`. Override with `--image-model NAME`
  (e.g. `gpt-image-1-mini` for a cheaper draft) or `--base PATH` to change where
  the sheet is written.
- This spends one image-generation call.
- Related skills: [social-story-json], [social-story-page], [social-story-redo].
