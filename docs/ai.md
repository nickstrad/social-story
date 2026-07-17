# AI actions and provider adapters

This is the living standard for AI-assisted behavior in Social Story. Update it
whenever an action, public contract, prompt policy, provider binding, fake, or
extension workflow changes.

## Principle

Application code depends on product actions, not model-provider primitives:

```ts
deps.ai.storyToData.convert(...)
deps.ai.characterPhotoAutofill.suggest(...)
deps.ai.baseImage.generate(...)
deps.ai.pageImage.generate(...)
deps.ai.coverImage.generate(...)
```

An action says what the product needs and owns a small semantic contract. It does
not expose chat roles, arbitrary prompts or schemas, endpoint names, model IDs,
provider file IDs, or image-edit request options. This lets each action choose a
provider and model independently without changing tasks, routes, domain code, or
UI code.

Do not introduce a universal LLM provider or lowest-common-denominator text/image
generator. A provider implements only the actions it supports.

## Module and import boundaries

```text
src/server/ai/
├── index.ts                 provider-neutral public API
├── types.ts                 shared semantic values
├── errors.ts                safe provider-neutral errors
├── ports/                   one contract per product action
├── prompts/                 pure prompt policy owned by actions
├── openai/                  private OpenAI transports and action adapters
├── testing/                 deterministic action fakes and PNG fixtures
└── create-ai.ts             provider/model composition root
```

Tasks, routes, services, hooks, and tests may import contracts from
`@/server/ai`. Production application code calls actions through `Deps.ai`.
Only `create-ai.ts` and adapter tests import `ai/openai/**`; OpenAI constructors
are deliberately absent from the public barrel. Provider environment values are
read only in `src/server/config.ts` and interpreted only by the composition root.

Prompt builders are pure product policy. They live under `ai/prompts`, and
provider action adapters decide how to arrange them into provider requests.
Application call sites pass semantic data and never assemble prompts.

## Action catalog

| Action                   | Semantic input and output                                                                            | Binding/model                   | Prompt owner                          | Deterministic fake                                              | Production caller                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| `storyToData`            | Script, cast context, rules → validated `ParsedStory`                                                | `AI_STORY_TO_DATA_*`            | `prompts/story-to-data.ts`            | `createFakeAiActions({ storyToData })`; E2E parse fixture       | `inngest/functions/parseStory.ts`                       |
| `characterPhotoAutofill` | Authorized normalized `InputImage` → exact `appearance` and `photoDescription` suggestion            | `AI_CHARACTER_PHOTO_AUTOFILL_*` | `prompts/character-photo-autofill.ts` | bounded suggestion in `createE2eAiActions`                      | `POST /api/describe/photo`                              |
| `baseImage`              | Cast, labeled photos, dimensions → `GeneratedArtwork`                                                | `AI_BASE_IMAGE_*`               | `prompts/illustration.ts`             | `createFakeAiActions({ baseImage })`; E2E base fixture          | `inngest/functions/baseImage.ts`                        |
| `pageImage`              | Scene, page cast, full cast, rules, steering, explicit anchor/photo, dimensions → `GeneratedArtwork` | `AI_PAGE_IMAGE_*`               | `prompts/illustration.ts`             | `createFakeAiActions({ pageImage })`; E2E scripted page fixture | content-page branch of `inngest/functions/pageImage.ts` |
| `coverImage`             | Title, cast, note, explicit anchor/photo, dimensions → `GeneratedArtwork`                            | `AI_COVER_IMAGE_*`              | `prompts/illustration.ts`             | `createFakeAiActions({ coverImage })`; E2E cover fixture        | cover branch of `inngest/functions/pageImage.ts`        |

All current production bindings use OpenAI. Separate constructors and bindings
are intentional even where the implementation shares a private transport.

## Public contracts

- `InputImage` contains already-authorized bytes and a media type. Ports never
  receive asset IDs, storage URLs, or provider file IDs.
- `CharacterContext` and `RuleContext` contain only prompt-relevant values; they
  are not persistence records. Task handlers project repository entities through
  `toCharacterContext` and `toRuleContext` before invoking an action, so IDs,
  asset references, photo descriptions, and timestamps do not cross the port at
  runtime.
- `ImageDimensions` is an application request. An adapter rejects unsupported or
  invalid values as a provider-neutral action error.
- `GeneratedArtwork` is a valid PNG buffer plus the exact `promptUsed`. Providers
  normalize other formats before returning. Tasks persist `promptUsed` for audit
  and never store provider response objects.
- Structured action adapters own schema wiring, JSON parsing, refusal handling,
  and validation. Callers cannot provide arbitrary schemas.
- `AiActionError` exposes a safe code (`invalid_input`, `content_rejected`,
  `invalid_response`, `rate_limited`, `unavailable`, or `misconfigured`) and a
  retryable flag. Provider diagnostics remain only in the `cause`; user-facing
  messages never reveal providers, endpoints, models, tokens, or response bodies.

## Configuration and composition

Each action has `AI_<ACTION>_PROVIDER` and `AI_<ACTION>_MODEL` variables in
`.env.example`. The provider defaults to `openai`. An explicit action model wins;
otherwise text actions fall back to deprecated `OPENAI_CHAT_MODEL` and image
actions to deprecated `OPENAI_IMAGE_MODEL`. `OPENAI_TOKEN` remains a provider
credential rather than part of any action contract.

`parseConfig` currently accepts only `openai` for every action and reports the
action-specific environment key for unsupported values. `create-ai.ts` uses an
explicit switch per action, which is the capability matrix and compile-time
exhaustiveness point. Do not replace it with a magic constructor registry.

A future deployment could compose bindings conceptually like this without any
caller changes:

```text
storyToData            -> OpenRouter / a structured-output model
characterPhotoAutofill -> OpenAI / a vision model
baseImage              -> a Google image provider
pageImage              -> that provider's page model
coverImage             -> OpenAI / a separate image model
```

Only providers and pairings actually implemented by the composition root may be
configured. Credentials should be conditionally required for the selected
actions; selecting one provider for text must not require an unrelated provider's
text model or credential.

## Synchronous photo autofill

`POST /api/describe/photo` authenticates, checks story ownership, validates the
upload, and normalizes it to bounded PNG bytes before invoking
`ai.characterPhotoAutofill.suggest`. The action neither accesses storage nor
persists data. Its safety prompt describes visible illustration-relevant details,
does not identify the person or infer sensitive traits, and returns only the two
bounded fields.

The client invokes the route only after **Auto-fill from photo** is clicked,
places suggestions into the form, and reminds the author to review them. Normal
form submission is the only persistence path. Keep 400/404 validation behavior
and the safe 502 failure copy provider-neutral.

## Durable workflows and sensitive data

AI tasks remain inside the named Inngest workflow registry and existing durable
step boundaries. The action call and persistence stay together inside these
steps:

- `Convert story to structured page JSON with AI and save pages`
- `Generate and save character reference sheet with AI`
- `Generate and save page illustration with AI`

Keep their event/function identities, claim/complete steps, retry, concurrency,
idempotency, and `TaskStepRunner` signature stable. Durable outputs may contain
provider-neutral counts, output sizes, asset IDs, variants, and byte counts. They
must never contain raw scripts, prompts, photos/data URLs, parsed page content, or
generated bytes. Inline tests and E2E omit the step runner but use the same task
handlers.

## Testing and local development

Use `createFakeAiActions` and configure only the semantic actions a test reaches.
An unconfigured action throws `No fake configured for ai.<action>`, preventing a
test from silently using an unrelated canned result. `fakeArtwork` supplies a
tiny valid PNG. Integration tests may record the full semantic action input; they
should not key behavior by prompt text.

`E2E_FAKES=1` selects `createE2eAiActions` through `createE2eDeps`. It supplies
deterministic parse, photo-autofill, base, page, and cover behavior while storage
and dispatch are also faked. Unit and integration tests mock `fetch` at the
private adapter boundary. No test may call a model provider or external network.

## Adding an action

1. Add one semantic port and the smallest shared value types it needs. Do not
   expand an unrelated action or add an arbitrary prompt/schema escape hatch.
2. Add pure prompt policy under `prompts/` when applicable.
3. Implement the action for at least one provider, including output validation,
   normalization, and `AiActionError` mapping.
4. Add an action binding to `Config.ai`, `.env.example`, `testConfigEnv()` when
   required, and an explicit composition function in `create-ai.ts`.
5. Add a loud deterministic fake, mocked-transport adapter tests, semantic
   integration coverage, and zero-network E2E behavior.
6. Call the action through `deps.ai` while keeping authorization, persistence,
   workflows, and UI behavior outside the adapter.
7. Update this catalog and extension guidance in the same change.

## Adding a provider for one action

Implement only the supported action port in a new provider directory. Keep its
transport, response types, options, and diagnostics private. Extend that action's
provider union/config validation and its explicit factory case; conditionally
validate the new credential. Map failures to `AiActionError`, return the public
invariants, add a deterministic fake where behavior changes, and test the adapter
with a mocked transport. Existing callers and other action ports should not
change.

## Troubleshooting

Start with the failing action and its selected binding in parsed configuration.
Confirm that `create-ai.ts` chose the expected adapter and, in tests/E2E, that
`createFakeAiActions` or `E2E_FAKES=1` configured that exact action. Then inspect
safe action codes and server-side cause chains. Never print credentials, raw
provider bodies, scripts, photos, or image bytes, and never inspect `.env.local`.
