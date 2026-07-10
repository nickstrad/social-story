# Change summary — feature/openai-service

Plan: docs/06-openai-service.md

## What was implemented

- Added provider-neutral text and image generation ports and wired OpenAI adapters into the dependency container.
- Added transparent REST adapters for structured chat completions, image generations, multipart image edits, base64 decoding, and retry/backoff behavior.
- Added test fakes, including a Sharp-compatible 4×4 PNG image generator.
- Added a Sharp caption compositor with exported wrapping, sizing, and SVG helpers.
- Added unit and integration-style tests for validation, endpoint and multipart selection, retries, caption geometry, pixel preservation, and blank-caption passthrough.
- Added a direct `sharp` dependency. Zod 4's native JSON Schema converter is used because `zod-to-json-schema` emits empty definitions for Zod 4 schemas.

## What /simplify changed

- Aligned the direct Sharp dependency with Next.js's existing Sharp version to avoid a duplicate native dependency stack.
- Kept shared response decoding, multipart construction, XML escaping, and retry/error handling in focused helpers to reduce duplication and keep the public adapter methods readable.
- Removed the unused direct `zod-to-json-schema` dependency, capped retry delays at 30 seconds, and added explicit strict-schema assertions following judge feedback.
- Renamed the configured OpenAI credential variable from `OPENAPI_TOKEN` to `OPENAI_TOKEN` to match the deployed environment.

## Notes for review

- `npx vitest run --project server --exclude src/server/__tests__/db.int.test.ts` passes (46 tests), as do TypeScript, ESLint, and the production build.
- The complete `npm run test:run` reaches 46 passing tests but fails the existing Prisma integration test because the configured Neon database is unreachable. No environment files were inspected or modified beyond the required opaque copy.
- The optional live OpenAI smoke script was not added or run because it requires a real token and is not part of CI.
