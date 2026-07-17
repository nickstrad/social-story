# Plan 16 — Action-specific AI ports and provider adapters

**Depends on:** the current story parse, character upload, base-image, and page-image flows. Start implementation from the latest `main` and rebase the in-progress photo-to-character-data branch before integrating its call site. **Behavioral scope:** preserve current story and image generation behavior while replacing the generic text/image dependency surface. The photo-analysis action gets a stable port and OpenAI adapter here, but its upload/form UX remains owned by the in-progress feature branch.

## Goal

Make every AI-assisted product action independently replaceable. OpenAI remains the first implementation, but changing story-to-data to OpenRouter, base-image generation to a Google image provider, and cover generation to OpenAI must be a composition/configuration change rather than a task, router, domain, or UI rewrite.

The public dependency surface should describe what the product is doing:

```ts
deps.ai.storyToData.convert(...)
deps.ai.characterPhotoToData.extract(...)
deps.ai.baseImage.generate(...)
deps.ai.pageImage.generate(...)
deps.ai.coverImage.generate(...)
```

It must not describe a provider's technical API:

```ts
deps.text.generateJson({ system, user, schema })
deps.image.generate({ prompt, referenceImages, width, height })
```

No action port may expose OpenAI names, model IDs, endpoint concepts, chat roles, response-format options, provider-specific image options, or SDK/HTTP response types.

## Current-state findings

- `TextGenerator` and `ImageGenerator` are provider-neutral, but they are broad technical primitives rather than product capabilities. Tasks currently know prompt construction, schemas, reference ordering, and image-generation mechanics.
- `Deps` has only one text generator and one image generator. `OPENAI_CHAT_MODEL` and `OPENAI_IMAGE_MODEL` therefore couple all text actions and all image actions to the same provider/model.
- `PAGE_IMAGE` handles both covers and content pages through the same `deps.image.generate` call even though those actions need to be independently routable.
- Prompt builders are pure and well tested, but they are imported directly by task handlers. A future provider adapter cannot adjust request formation without knowledge leaking back into the task.
- The OpenAI REST code already has useful private primitives: retrying HTTP, strict structured output validation, image generations, and multi-image edits. Keep those implementation details reusable inside the OpenAI adapter only.
- Character uploads are normalized to bounded PNGs before storage. That is a suitable provider-neutral input for the photo-analysis port and avoids passing storage URLs or provider file IDs through the interface.
- Existing fakes are modality-wide and often keyed by raw prompt text. Tests need action-specific fakes so they state intent and can record semantic inputs.

## 1. Create a dedicated `src/server/ai` module

Keep the AI boundary cohesive rather than adding five unrelated top-level port files. Use this structure:

```text
src/server/ai/
  index.ts                         # provider-neutral public exports only
  types.ts                         # shared action input/output value types
  errors.ts                        # provider-neutral failure taxonomy
  ports/
    story-to-data.ts
    character-photo-to-data.ts
    base-image.ts
    page-image.ts
    cover-image.ts
  prompts/
    story-to-data.ts
    character-photo-to-data.ts
    illustration.ts
  openai/
    http.ts
    structured-output.ts           # private OpenAI transport helper
    image-generation.ts            # private OpenAI transport helper
    story-to-data.ts
    character-photo-to-data.ts
    base-image.ts
    page-image.ts
    cover-image.ts
  testing/
    fakes.ts
    fixtures.ts
  create-ai.ts                     # the only provider-selection/composition code
```

`src/server/ai/index.ts` is the module's provider-neutral public API. Application code may import contracts and value types from it, but only `create-ai.ts` and adapter tests may import `src/server/ai/openai/**`. Do not export OpenAI constructors from the public barrel.

Move the existing AI-specific prompt builders from `src/server/domain/prompts.ts` into `src/server/ai/prompts/**`. They remain pure product policy and may be shared by multiple provider adapters; moving them behind the AI module prevents tasks from assembling provider requests. Keep their current focused tests.

Do not introduce a universal `LlmProvider`, a provider base class, or a registry that claims every provider supports every action. Providers implement only the action ports they actually support. Shared code belongs in private transport helpers, not in a lowest-common-denominator public interface.

## 2. Define semantic, provider-neutral action contracts

Define small shared value types in `types.ts`:

- `InputImage`: `{ data: Buffer; mediaType: string }`. It represents bytes already loaded and authorized by application code; ports never receive blob URLs, asset IDs, or provider file IDs.
- `ImageDimensions`: positive integer `width`/`height` requested by the application.
- `CharacterContext`: only the character fields relevant to generation (`name`, `role`, `age`, `appearance`, and optional `photoDescription`), with no repo IDs or timestamps unless an action genuinely needs them.
- `RuleContext`: only the normalized rule text/kind and character names needed by prompts, not persistence records.
- `GeneratedArtwork`: `{ png: Buffer; promptUsed: string }`. PNG is an application invariant required by captioning and storage. An adapter returning another format must normalize it before fulfilling the port. `promptUsed` preserves the existing audit field without exposing provider response objects.

The action ports should have semantic arguments and domain results:

### `StoryToData`

```ts
interface StoryToData {
  convert(input: {
    script: string
    characters: readonly CharacterContext[]
    rules: readonly RuleContext[]
  }): Promise<ParsedStory>
}
```

The adapter owns the system/user message arrangement, structured-output schema wiring, refusal handling, JSON parsing, and validation. The port does not accept an arbitrary Zod schema or raw prompt.

### `CharacterPhotoToData`

```ts
interface CharacterPhotoToData {
  extract(input: {
    photo: InputImage
    current?: { name?: string; role?: string; age?: string }
  }): Promise<CharacterPhotoSuggestion>
}
```

`CharacterPhotoSuggestion` contains reviewable suggestions for the existing form's illustration-relevant fields: `age`, `appearance`, and `photoDescription`. It must not claim to identify the person, invent a name/relationship, or persist changes. The feature branch remains responsible for showing suggestions to the user and applying only what the user accepts. Put its Zod schema beside the action contract so every adapter and fake returns the same shape.

### `BaseImageGenerator`

Accept the cast, zero or more labeled character photos, and desired dimensions. The adapter/prompt policy owns construction of the reference-sheet request. Return `GeneratedArtwork`.

### `PageImageGenerator`

Accept the scene, selected characters, full cast, applied rules, optional steering text, optional anchor sheet, optional character photo, and desired dimensions. Reference roles are explicit fields rather than an order-sensitive array in the public contract. The adapter converts them to whatever ordering or request format its provider requires. Return `GeneratedArtwork`.

### `CoverImageGenerator`

Accept title, cast, optional cover note, optional anchor sheet, optional character photo, and desired dimensions. Keep this separate from page generation even while OpenAI shares most of the implementation; it is an independent provider/model seam. Return `GeneratedArtwork`.

Group the five interfaces for dependency injection:

```ts
interface AiActions {
  storyToData: StoryToData
  characterPhotoToData: CharacterPhotoToData
  baseImage: BaseImageGenerator
  pageImage: PageImageGenerator
  coverImage: CoverImageGenerator
}
```

## 3. Normalize errors at the boundary

Add a small provider-neutral `AiActionError` with stable categories such as `invalid_input`, `content_rejected`, `invalid_response`, `rate_limited`, `unavailable`, and `misconfigured`, plus a retryable flag and safe user-facing message.

OpenAI adapters map HTTP failures, refusals, malformed structured output, missing image data, and unsupported dimensions to these categories while preserving the original error as `cause`. Task errors shown in the UI must not expose provider names, endpoints, tokens, raw response bodies, or model IDs. Keep diagnostic detail available to server logging/tests through the cause chain.

Do not add provider-specific error types to any port signature.

## 4. Implement OpenAI as the first adapter for every action

Retain plain `fetch` and the existing retry/backoff behavior. Rehome `services/openai/http.ts` as the private OpenAI HTTP helper and split the current generic adapters into private transport helpers plus action adapters:

- `structured-output.ts` accepts OpenAI-specific request content, schema, and model configuration and returns validated data. It is not exported outside `ai/openai`.
- `image-generation.ts` owns OpenAI generation/edit endpoints, multipart reference images, size mapping, base64 decoding, and PNG normalization. It is not exported outside `ai/openai`.
- Each action adapter implements exactly one public action port, invokes the appropriate pure prompt policy, selects its configured model, and maps transport failures into `AiActionError`.
- The story adapter validates `ParsedStory` internally.
- The character-photo adapter sends image bytes as a supported multimodal input and validates `CharacterPhotoSuggestion` internally.
- Base, page, and cover adapters may share the private image helper, but remain separate constructors so they can receive different models and later be replaced independently.

This refactor does not need to migrate the working story parser from Chat Completions to the Responses API. Current OpenAI documentation supports strict structured output on both surfaces, and image reference generation remains supported through the image edit API. Keep endpoint migration separate from the architectural change; the private transport boundary makes a later migration local to the OpenAI adapter.

## 5. Add per-action provider/model configuration

Represent each action as a typed binding in `Config["ai"]`:

```ts
type AiActionBinding = {
  provider: "openai"
  model: string
}

ai: {
  storyToData: AiActionBinding
  characterPhotoToData: AiActionBinding
  baseImage: AiActionBinding
  pageImage: AiActionBinding
  coverImage: AiActionBinding
}
```

Use provider-neutral, action-specific env settings with OpenAI defaults:

```text
AI_STORY_TO_DATA_PROVIDER=openai
AI_STORY_TO_DATA_MODEL=<current chat default>
AI_CHARACTER_PHOTO_TO_DATA_PROVIDER=openai
AI_CHARACTER_PHOTO_TO_DATA_MODEL=<current chat default>
AI_BASE_IMAGE_PROVIDER=openai
AI_BASE_IMAGE_MODEL=<current image default>
AI_PAGE_IMAGE_PROVIDER=openai
AI_PAGE_IMAGE_MODEL=<current image default>
AI_COVER_IMAGE_PROVIDER=openai
AI_COVER_IMAGE_MODEL=<current image default>
```

Keep `OPENAI_TOKEN` provider-specific. Preserve `OPENAI_CHAT_MODEL` and `OPENAI_IMAGE_MODEL` as deprecated fallback inputs for one release so existing environments continue working; action-specific model settings win. Document the precedence in `.env.example` without inspecting or editing `.env.local`.

Initially validate the provider value as `openai`. When a second adapter lands, extend only the actions it supports and conditionally require that provider's credential. A configuration such as story-to-data via OpenRouter and images via OpenAI must not require an OpenAI text model, and an unsupported provider/action pairing must fail at startup with the action name in the error.

`create-ai.ts` uses explicit exhaustive factories per action. Avoid a magic string-to-constructor registry: the explicit mapping documents the capability matrix and gives compile-time errors when a binding is added without an adapter.

Update `testConfigEnv()` in the same change. Defaults should keep tests concise, and all credentials in test config remain visibly fake.

## 6. Rewire application code to the action surface

Change `Deps` from `text`/`image` to a single `ai: AiActions` field and construct it with `createAi(config)` in `container.ts`.

- `parseStory.ts` calls `deps.ai.storyToData.convert({ script, characters, rules })`; it continues to own repo reads, destructive re-parse protection, rule application, page replacement, and story updates.
- `baseImage.ts` loads authorized photo bytes, converts persistence entities to action context, and calls `deps.ai.baseImage.generate(...)`; it continues to own storage and replacement of the story's base asset.
- `pageImage.ts` continues to own rule enforcement, character resolution, deterministic reference-photo choice, variant allocation, captioning, and asset persistence. It calls `deps.ai.coverImage` for a cover and `deps.ai.pageImage` for a content page. The returned `promptUsed` is persisted exactly as today.
- The character photo feature branch calls `deps.ai.characterPhotoToData.extract(...)` after upload validation/normalization and before presenting form suggestions. Do not put provider calls in React hooks/components or let the adapter write repositories.
- Routers remain thin and must not import OpenAI code or provider configuration.

After all callers migrate, delete `src/server/ports/text.ts`, `src/server/ports/image.ts`, `services/openai/text.ts`, and `services/openai/image.ts`. Rehome the shared input-image type and OpenAI HTTP tests under `src/server/ai`. Acceptance includes no remaining `deps.text`, `deps.image`, `TextGenerator`, or generic `ImageGenerator` imports.

## 7. Make testing and local development action-friendly

Replace modality-wide fakes with an action-aware test builder:

```ts
createFakeAiActions({
  storyToData: async (input) => parsedFixture,
  pageImage: recordingPageImage(...),
})
```

Unconfigured actions should throw a clear `No fake configured for ai.<action>` error rather than silently returning unrelated data. Provide focused helpers/recorders for common tests and a tiny valid PNG fixture for image actions.

Create a dedicated `createE2eAiActions` that returns the existing parse fixture and scripted image fixtures for all three image actions. E2E remains environment-wired through `E2E_FAKES=1`; no test may call a real model provider or network endpoint.

The test helper should make the common case one line in router/service tests while still letting an integration test inspect the full semantic call. Avoid canned responses keyed by prompt strings except in prompt-policy unit tests.

## 8. Add living AI architecture documentation and agent guidance

Create `docs/ai.md` as the living reference for this subsystem. Unlike this pre-implementation plan, it must describe the code as actually implemented and remain current when actions, providers, prompts, bindings, or error behavior change. Include:

- the action-port principle and why application code depends on product actions rather than generic text/image model calls;
- the `src/server/ai` module map and its allowed import directions;
- a table of every action, its semantic inputs/output, current provider binding, configured model, prompt-policy owner, fake, and production call sites;
- the provider-neutral image, structured-data, error, and `promptUsed` contracts;
- configuration precedence, including action-specific bindings, legacy OpenAI model fallbacks, provider credentials, and startup validation behavior;
- how to add a new AI action without expanding an unrelated port;
- how to add a provider for one supported action, including adapter, config, factory case, error mapping, deterministic fake, mocked-transport tests, and zero-network E2E requirements;
- how the photo-to-character-data branch should call the action and keep suggestions reviewable before persistence;
- a concise example showing a mixed binding (for example, story-to-data on one provider and separate base/page/cover image providers) without requiring that those providers be implemented;
- operational troubleshooting that starts with the selected action binding and fake wiring, never by exposing credentials or inspecting `.env.local`.

Update `docs/index.md` to list `ai.md` under reference docs and include it in the folder map. Its description should make clear that it is the source of truth for AI actions, provider adapters, bindings, prompts, fakes, and extension rules.

Update the root `CLAUDE.md` (and therefore its `AGENTS.md` symlink) with a short **AI actions and providers** section requiring agents to read `docs/ai.md` before changing any AI action, prompt, provider adapter, model/provider config, or AI fake. Encode these durable rules there:

- product code calls semantic actions through `deps.ai`; it never calls provider transports directly;
- provider code stays inside its adapter directory and provider settings stay in `config.ts`/the composition root;
- adding or changing an action/provider requires a deterministic fake and network-free tests;
- update `docs/ai.md` in the same change whenever the action catalog, public contracts, bindings, configuration, prompts, or extension workflow changes.

Also replace the root Testing/E2E section's now-stale references to `fakeTextGenerator`, `fakeImageGenerator`, `staticTextGenerator`, `scriptedImageGenerator`, and `deps.text`/`deps.image` with the final action-aware fake names and `deps.ai` wiring. The durable instructions must describe the code developers will actually use after this refactor, not preserve the legacy vocabulary.

Update `docs/CLAUDE.md` (and therefore `docs/AGENTS.md`) so the documentation map includes `ai.md` and tells documentation editors that it is a living standard rather than a historical plan. Do not create a second nested `src/server/ai/AGENTS.md` unless implementation reveals rules that apply only inside that subtree; duplicating the root rules would invite drift.

Do not edit `docs/plans/completed/00-overview.md` to represent the new current architecture. Completed plans are historical records by repository convention; `docs/ai.md` is the living source of truth and this plan moves to `completed/` after merge.

## Tests and verification

- Unit-test each action contract's schema/value conversion and the pure prompt policies.
- Unit-test `AiActionError` mapping, safe messages, retryability, and preservation of causes.
- With mocked `fetch`, test each OpenAI action adapter:
  - story-to-data builds a structured request and validates `ParsedStory`;
  - character-photo-to-data includes image input and validates suggestions;
  - base/page/cover select their own configured model;
  - page and cover map semantic anchor/photo fields to the provider's required reference order;
  - image outputs are valid PNG buffers and return the exact `promptUsed`;
  - refusals, invalid schemas, rate limits, missing image data, and provider outages map to safe errors.
- Add config tests for defaults, legacy model fallback, action override precedence, and actionable unsupported provider/action errors.
- Update parse/base/page integration tests to record semantic action calls. Assert that cover generation reaches only `ai.coverImage`, content generation reaches only `ai.pageImage`, and failure leaves existing persistence unchanged.
- Keep existing caption, asset, task, and router behavior tests green.
- Run `npm run test:run`, `npm run lint`, `npm run format:check`, and `npm run build`.
- Run `npm run test:e2e` because composition-root and every generation path change. It must use the repository-owned port 3100 server with `E2E_FAKES=1` and make zero external calls.
- Search the final tree for forbidden coupling: OpenAI imports outside `src/server/ai/openai/**`/`create-ai.ts`, provider env reads outside `config.ts`, and legacy generic generator names/usages.
- Verify `docs/ai.md`, `docs/index.md`, root `CLAUDE.md`/`AGENTS.md`, and `docs/CLAUDE.md`/`AGENTS.md` agree with the final module names, configuration keys, fake helpers, and import rules.

## Acceptance criteria

- Tasks, routers, domain modules, hooks, and components contain no OpenAI imports, OpenAI request vocabulary, model IDs, or provider-specific options.
- Each AI product action has a separate, semantic port and can be bound to a provider/model independently.
- OpenAI implements all five ports first, using shared private transport helpers without exposing those helpers as application dependencies.
- Story parse, base-image, page-image, cover-image, captions, variants, task state, and asset persistence remain behaviorally unchanged.
- The photo-to-character-data branch has a ready OpenAI-backed action port that returns reviewable provider-neutral suggestions and performs no persistence itself.
- Generated artwork is normalized to PNG at the adapter boundary, and stored `promptUsed` remains available.
- Tests and E2E use action-specific deterministic fakes and never access a real database (outside Playwright's disposable Postgres), API, or network.
- `docs/ai.md` is a complete living guide, `docs/index.md` links it, and the root/docs agent instructions require future AI changes to follow and maintain it.
- Adding OpenRouter for only story-to-data or a different base-image provider requires one adapter, one supported binding case, provider credentials/config, and adapter tests; no existing task/router/domain/UI edit is required.

## Out of scope

- Implementing OpenRouter, Google/Nano Banana, Anthropic, or any second provider in this plan.
- An end-user provider/model picker, billing controls, or exposing provider names in the product UI.
- Automatic provider fallback, load balancing, A/B testing, or retrying an action through a different provider.
- Prompt redesign, model upgrades, quality comparisons, or an OpenAI API-surface migration unrelated to the boundary refactor.
- Implementing or duplicating the in-progress photo upload/form UX; this plan supplies the port, OpenAI adapter, fake, and composition seam it consumes.
- Database migrations for provider/model provenance. Add generic provenance in a separate plan if experiments need historical comparison beyond deployment configuration and logs.
