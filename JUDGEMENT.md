# Judgement — feature/pdf-export

Plan: docs/12-pdf-export.md
Verdict: READY

## Blockers
_none_

## Should-fix

- **E2E test deviates from the plan's "real test DB" wording** — `src/server/__tests__/e2e.int.test.ts:1`. The plan specifies "fakes … real test DB" and a "sign-up user", but the test runs entirely on `inMemoryRepos` + a constructed session user. This is a documented, user-directed deviation (recorded in CLAUDE.md's **# Testing** section, which overrides the plan), so it does not block — but the plan doc and the test's coverage claim now diverge. Resolve by noting the policy change in `docs/12-pdf-export.md` (or accepting the CHANGE_SUMMARY note as the record) so future readers don't think the capstone silently skipped its spec.

## Nits

- **Plural grammar in the failure message** — `src/server/inngest/functions/pdfExport.ts:33`. With multiple missing pages the error reads "Cannot export: the cover, page 2 has no image" — "has" should be "have" when the list has more than one entry. Pick the verb from `missing.length`.
- **Possible "page undefined" in the failure list** — `src/server/inngest/functions/pdfExport.ts:29`. If a missing `pageId` ever isn't in `byId` (shouldn't happen — `missing` is derived from the same `pages` array), the message would render `page undefined`. A fallback like `an unknown page` would make the impossible case readable.
- **`latestExportTask` in `useExport.ts` duplicates the reduce in `pdf.latest`** — `src/hooks/useExport.ts:14` and `src/server/api/routers/pdf.ts:47` both open-code "newest task of type X by createdAt". The CHANGE_SUMMARY already notes a shared `latestTaskOfType` was considered and skipped as spanning pre-existing files; acceptable, just flagging the third copy now exists.
