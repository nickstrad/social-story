import type { AiActionBinding, Config } from "@/server/config"

import type { AiActions } from "."
import { openAIBaseImage } from "./openai/base-image"
import { openAICharacterPhotoAutofill } from "./openai/character-photo-autofill"
import { openAICoverImage } from "./openai/cover-image"
import { openAIPageImage } from "./openai/page-image"
import { openAIStoryToData } from "./openai/story-to-data"
import type { OpenAIActionConfig } from "./openai/structured-output"

function openAIConfig(
  binding: AiActionBinding,
  config: Config["openai"]
): OpenAIActionConfig {
  return { token: config.token, model: binding.model }
}

export function createAi(config: Pick<Config, "ai" | "openai">): AiActions {
  const { ai, openai } = config
  return {
    storyToData: createStoryToData(ai.storyToData, openai),
    characterPhotoAutofill: createCharacterPhotoAutofill(
      ai.characterPhotoAutofill,
      openai
    ),
    baseImage: createBaseImage(ai.baseImage, openai),
    pageImage: createPageImage(ai.pageImage, openai),
    coverImage: createCoverImage(ai.coverImage, openai),
  }
}

function createStoryToData(binding: AiActionBinding, openai: Config["openai"]) {
  switch (binding.provider) {
    case "openai":
      return openAIStoryToData(openAIConfig(binding, openai))
  }
}

function createCharacterPhotoAutofill(
  binding: AiActionBinding,
  openai: Config["openai"]
) {
  switch (binding.provider) {
    case "openai":
      return openAICharacterPhotoAutofill(openAIConfig(binding, openai))
  }
}

function createBaseImage(binding: AiActionBinding, openai: Config["openai"]) {
  switch (binding.provider) {
    case "openai":
      return openAIBaseImage(openAIConfig(binding, openai))
  }
}

function createPageImage(binding: AiActionBinding, openai: Config["openai"]) {
  switch (binding.provider) {
    case "openai":
      return openAIPageImage(openAIConfig(binding, openai))
  }
}

function createCoverImage(binding: AiActionBinding, openai: Config["openai"]) {
  switch (binding.provider) {
    case "openai":
      return openAICoverImage(openAIConfig(binding, openai))
  }
}
