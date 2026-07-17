import { parsedStorySchema } from "@/server/domain/schemas"

import type { AiActions } from ".."

export { fakeArtwork, fakePng } from "./fixtures"

type FakeAiOverrides = {
  storyToData?: AiActions["storyToData"]["convert"]
  characterPhotoAutofill?: AiActions["characterPhotoAutofill"]["suggest"]
  baseImage?: AiActions["baseImage"]["generate"]
  pageImage?: AiActions["pageImage"]["generate"]
  coverImage?: AiActions["coverImage"]["generate"]
}

function missing(action: keyof AiActions): never {
  throw new Error(`No fake configured for ai.${action}`)
}

export function createFakeAiActions(
  overrides: FakeAiOverrides = {}
): AiActions {
  return {
    storyToData: {
      convert: overrides.storyToData ?? (() => missing("storyToData")),
    },
    characterPhotoAutofill: {
      suggest:
        overrides.characterPhotoAutofill ??
        (() => missing("characterPhotoAutofill")),
    },
    baseImage: {
      generate: overrides.baseImage ?? (() => missing("baseImage")),
    },
    pageImage: {
      generate: overrides.pageImage ?? (() => missing("pageImage")),
    },
    coverImage: {
      generate: overrides.coverImage ?? (() => missing("coverImage")),
    },
  }
}

const PHOTO_SUGGESTION = {
  appearance: "Short dark hair and a bright blue shirt",
  photoDescription: "A smiling person outdoors, wearing a bright blue shirt.",
}

export function createE2eAiActions(input: {
  parsedStory: unknown
  baseImage: () => Buffer
  pageImage: (scene: string) => Buffer
  coverImage: () => Buffer
}): AiActions {
  return createFakeAiActions({
    storyToData: async () => parsedStorySchema.parse(input.parsedStory),
    characterPhotoAutofill: async () => PHOTO_SUGGESTION,
    baseImage: async () => ({
      png: Buffer.from(input.baseImage()),
      promptUsed: "E2E character reference sheet",
    }),
    pageImage: async ({ scene }) => ({
      png: Buffer.from(input.pageImage(scene)),
      promptUsed: `E2E page illustration: ${scene}`,
    }),
    coverImage: async () => ({
      png: Buffer.from(input.coverImage()),
      promptUsed: "E2E cover illustration",
    }),
  })
}
