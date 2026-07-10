# Judgement — feature/openai-service

Plan: docs/06-openai-service.md
Verdict: READY

## Blockers

_none_

## Should-fix

- **Unused `zod-to-json-schema` dependency** — `package.json:52`. The plan called for building the JSON schema via `zod-to-json-schema`, but the implementation (justifiably, per the change summary — the package emits empty definitions for Zod 4 schemas) uses Zod 4's native `toJSONSchema` in `src/server/services/openai/text.ts:1`. The `zod-to-json-schema` dependency was still added and is imported nowhere. Remove it from `package.json`/`package-lock.json` so the deviation is clean rather than half-applied.

## Nits

- **`strict: true` compatibility not exercised** — `src/server/services/openai/text.ts:56`. The request declares `strict: true`, which requires the emitted schema to have `additionalProperties: false` and all properties required. The test at `src/server/services/openai/text.test.ts:31` only asserts a property type, not that `toJSONSchema` output satisfies strict-mode constraints. A one-line assertion on `additionalProperties`/`required` would lock this in.
- **Optional smoke script omitted** — `scripts/smoke-openai.ts` (absent). The plan lists it as optional and the change summary explains the omission (needs a real token, not CI); acceptable, noting for completeness.
- **Backoff cap absent** — `src/server/services/openai/http.ts:14`. A hostile/large `Retry-After` value is honored unbounded. The Go original may behave the same; harmless at maxRetries=3 but a cap (e.g. 30s) would be safer.
