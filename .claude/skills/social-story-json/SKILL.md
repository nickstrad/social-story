---
name: social-story-json
description: Turn a social-story text file into the intermediate page JSON using the social-story tool. Use when the user says things like "make new social story json data from <filename>", "parse <file> into json", "build the story json from <file>", or otherwise wants the story text split into pages.
---

# Make social-story JSON data

Runs the `parse` command of the local `social-story` Go tool, which reads a
plain-text social story and writes a structured JSON file (title + pages, each
with `text` and `image_prompt`).

## Steps

1. Work in the project root: `/Users/nick/Software/social-story`.
2. Identify the input text file from the user's request (e.g. `social_story1.txt`).
   If they didn't name one, list `*.txt` in the project and ask which to use.
3. Choose the output JSON name: default to the input's base name with `.json`
   (e.g. `social_story1.txt` -> `social_story1.json`), unless the user specifies one.
4. Build the binary if it's missing or stale, then run parse:

   ```bash
   cd /Users/nick/Software/social-story
   go build -o social-story .
   ./social-story parse <input.txt> <output.json>
   ```

5. Report how many pages were written and the output path. Offer to preview the
   first few pages, and remind them the JSON is hand-editable before generating images.

## Notes

- The chat model defaults to `gpt-5.5`. Pass `--chat-model NAME` to override
  (e.g. `gpt-5.4-nano` for a cheaper parse).
- This step makes NO images and costs only a small chat call.
- Related skills: [social-story-base], [social-story-page], [social-story-redo].
