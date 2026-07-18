import type { ClientCharacter, Page, Rule, Task } from "./types"

const now = new Date("2026-01-01T00:00:00Z")

export function character(id: string, name = id): ClientCharacter {
  return {
    id,
    storyId: "story",
    name,
    role: null,
    age: null,
    appearance: null,
    photoAssetId: null,
    photoUrl: null,
    photoDescription: null,
    libraryCharacterId: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function rule(
  kind: Rule["kind"],
  characterIds: string[],
  text: string = kind
): Rule {
  return {
    id: `${kind}-${characterIds.join("-")}`,
    storyId: "story",
    text,
    kind,
    characterIds,
    createdAt: now,
    updatedAt: now,
  }
}

export function page(
  id: string,
  position: number,
  kind: Page["kind"] = "PAGE"
): Page {
  return {
    id,
    storyId: "story",
    kind,
    position,
    text: id,
    imagePrompt: id,
    characterIds: [],
    steeringText: null,
    hidden: false,
    selectedImageId: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function task(
  status: Task["status"],
  overrides: Partial<Task> = {}
): Task {
  return {
    id: status,
    userId: "user",
    storyId: "story",
    pageId: null,
    type: "PAGE_IMAGE",
    status,
    error: null,
    resultJson: null,
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
