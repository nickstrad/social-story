# Judgement — feature/characters-rules

Plan: docs/08-characters-rules.md
Verdict: READY

## Blockers
_none_

## Should-fix

- **Photo preview is never rendered** — `src/components/characters/CharacterForm.tsx:12` — The component declares the `photoPreviewUrl` prop (as the plan specifies) but never renders it anywhere in the form, so picking a file gives no visual feedback until the dialog closes and the card refreshes. The hook test even asserts `photoPreviewUrl` is set, yet no UI consumes it. Render a thumbnail (e.g. an `Avatar`/`img` next to the file input) driven by `photoPreviewUrl`.
- **Upload-in-flight skeleton is dead code** — `src/components/characters/CharacterCard.tsx:16` — `imagePending` defaults to `false` and `CharactersScreen.tsx` never passes it, so the plan's "`Skeleton` while … an upload is in flight" behavior on the card can never occur. Track the uploading character's id in `CharactersScreen` (surfaced from the form's `uploadState`) and pass `imagePending` to the matching card.

## Nits

- **File input rather than a dropzone area** — `src/components/characters/CharacterForm.tsx:56` — The plan calls for a "photo dropzone area"; a plain `<Input type="file">` works but doesn't accept drag-and-drop. Adding `onDrop`/`onDragOver` handlers on the wrapping block would satisfy the spec fully.
- **Character-delete cleanup can leave a stored rule below its structural minimum** — `src/server/api/routers/character.ts:66` — Removing a deleted character's id from a TOGETHER rule can leave it with one participant, which `ruleInputSchema` would reject on any future edit. The plan mandates this cleanup, so it's acceptable, but consider deleting rules that fall below their minimum instead of leaving them in an un-savable state.
- **`describeRule` fallback text** — `src/lib/ruleText.ts:4` — An empty `characterIds` structured rule renders "Selected characters always appear together"; unreachable through validated input plus the cleanup nit above notwithstanding, a guard or explicit wording would be more robust.
