---
name: social-story-redo
description: Make another alternate version of a page image that was already generated, without overwriting it, using the social-story tool. Use when the user says things like "make another image for page 1", "redo page 3", "give me a different version of page 2", or "try page 4 again".
---

# Redo a social-story page (alternate variant)

Runs the `redo` command of the local `social-story` Go tool. It regenerates one
page as a NEW variant with an incrementing suffix, so earlier versions are kept.
Repeated redos of page 1 produce `page1_1.png`, `page1_2.png`, and so on.

Use this (not the page/generate step) when the user wants a *different take* on a
page they already have.

## Steps

1. Work in the project root: `/Users/nick/Software/social-story`.
2. Find the story JSON (default to the most recent `*.json`, e.g.
   `social_story1.json`; ask if ambiguous).
3. Get the page number from the request.
4. Build the binary if missing/stale, then run:

   ```bash
   cd /Users/nick/Software/social-story
   go build -o social-story .
   ./social-story redo <story.json> <page#> images
   # add --caption to also print the page text into a band on the new variant
   ```

   The new file is `images/page<page#>_<n>.png` where `<n>` is the next unused int.
5. Read/display the new variant so the user can compare it to prior versions.

## Notes

- Uses the same anchor + photo logic as normal generation, so the family stays
  consistent; only the random variation changes.
- Image model defaults to `gpt-image-2`. Override with `--image-model NAME`.
- If the user wants to steer the redo (different scene), edit that page's
  `image_prompt` in the JSON first, then run redo.
- Related skills: [social-story-json], [social-story-base], [social-story-page],
  [social-story-caption].
