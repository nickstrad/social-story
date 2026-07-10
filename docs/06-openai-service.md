# Plan 06 — Generation Ports: OpenAI Adapters + Caption Compositor

**Depends on:** 04 (schemas), 01 (storage port, container). **Blocks:** 07, 09, 10. Can run in parallel with 02, 03, 05.

## Context

Read `docs/00-overview.md` and the OpenAI client code in `cli/main.go` (`parseStory`, `imageGenerate`, `imageEdit`, `doWithRetry`) plus `cli/caption.go`. This plan implements the **provider-agnostic ports** for text and image generation with OpenAI as implementation #1, and a sharp-based caption compositor replacing the Go freetype code. **No vendor concepts in port signatures.**

Config: the API key (`OPENAPI_TOKEN` — nonstandard name, keep) and model ids (`OPENAI_CHAT_MODEL`/`OPENAI_IMAGE_MODEL` with defaults) are already validated in `src/server/config.ts` (plan 01). Adapter constructors take a config slice (`getConfig().openai`) passed in by `container.ts` — **never read `process.env` directly**.

## Deliverables

### 1. Ports — `src/server/ports/text.ts`, `src/server/ports/image.ts`

```ts
export interface TextGenerator {
  generateJson<T>(args: {
    system: string
    user: string
    schema: ZodType<T>
    schemaName?: string
  }): Promise<T>
}
export interface ImageGenerator {
  generate(args: {
    prompt: string
    referenceImages?: { data: Buffer; mimeType: string }[]
    width: number
    height: number
  }): Promise<Buffer> // PNG bytes
}
```

### 2. OpenAI adapters — `src/server/services/openai/`

- `http.ts`: shared `requestWithRetry(fetchArgs, { maxRetries=3 })` — port of the Go `doWithRetry`: retry 429/5xx/network with exponential backoff (1s, 2s, 4s), honor `Retry-After`, fail fast on other 4xx. Extract `computeBackoff(attempt, retryAfterHeader): number` as a pure function (unit-test it). Use plain `fetch` (no OpenAI SDK — keeps the adapter transparent and matches the CLI).
- `text.ts` — `openAITextGenerator(config)`: chat completions with `response_format: json_schema` built via `zod-to-json-schema` (`npm i zod-to-json-schema`), parse + zod-validate the response (throw a descriptive error on mismatch).
- `image.ts` — `openAIImageGenerator(config)`: no references → `images/generations`; with references → multipart `images/edits` with repeated `image[]` parts and correct per-part MIME types (see Go `addImagePart`). Map width/height to the API `size` string. Decode `b64_json` → Buffer.
- Fakes for tests: `fakeTextGenerator(cannedByPrompt)`, `fakeImageGenerator()` (returns a tiny real 4x4 PNG buffer so sharp can consume it) in `src/server/services/fakes.ts`.
- Wire real adapters into `src/server/container.ts` (`deps.text`, `deps.image`).

### 3. Caption compositor — `src/server/services/caption.ts`

Port of `cli/caption.go` using **sharp** (`npm i sharp`):

- `addCaptionBand(png: Buffer, text: string): Promise<Buffer>` — appends a band BELOW the artwork (never covers it): soft lavender `#EAE2F6` background, near-black `#2B2B2B` text, font size = width/24, padding = width/20, line-height 1.35×, wrapped and centered. Implement text via an SVG `<text>` overlay rendered by sharp (measure/wrap with a pure `wrapText(text, maxCharsPerLine)` estimator, or embed a font and measure — SVG + `textLength`-free greedy wrap by character-width estimate is acceptable; verify visually).
- Pure helpers exported for tests: `wrapText`, `bandHeight(width, lineCount)`, `buildCaptionSvg(width, lines)`.
- Blank text → returns input unchanged.
- **Not idempotent by design** — callers must caption only the raw (band-free) image. Plans 09/10 store `rawUrl` and always caption from raw.

## Tests

- Unit: `computeBackoff` (attempt sequence, Retry-After wins); zod-validation failure raises; `wrapText`/`bandHeight` cases (long word, empty, exact fit).
- `caption.test.ts`: feed a generated solid-color PNG (make it with sharp in the test), assert output height > input height, width unchanged, top rows identical to source, band rows match band color; blank text → byte-identical passthrough.
- Adapter integration-ish tests with mocked `fetch` (msw or vi.stubGlobal): generations vs edits path selection, multipart field names, retry on 429 then success.

## Files created

`src/server/ports/{text,image}.ts`, `src/server/services/openai/{http,text,image}.ts`, `src/server/services/caption.ts`, `src/server/services/fakes.ts` + tests; edit `src/server/container.ts`.

## Interfaces exposed to other plans

`deps.text: TextGenerator`, `deps.image: ImageGenerator`, `addCaptionBand`, fakes.

## Acceptance criteria

- Optional smoke script `scripts/smoke-openai.ts` (run manually, needs real token) generates one image to `scratch/`; not part of CI.
- All tests green without network; build + lint pass.
