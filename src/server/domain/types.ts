export type StoryStatus = "DRAFT" | "PARSED" | "READY"
export type RuleKind =
  "TOGETHER" | "ALWAYS_INCLUDE" | "NEVER_INCLUDE" | "FREEFORM"
export type PageKind = "COVER" | "PAGE"
export type TaskType =
  "PARSE_STORY" | "BASE_IMAGE" | "PAGE_IMAGE" | "PDF_EXPORT"
export type TaskStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED"

export interface Story {
  id: string
  userId: string
  title: string
  script: string
  status: StoryStatus
  baseImageUrl: string | null
  coverNote: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Character {
  id: string
  storyId: string
  name: string
  role: string | null
  age: string | null
  appearance: string | null
  photoUrl: string | null
  photoDescription: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Rule {
  id: string
  storyId: string
  text: string
  kind: RuleKind
  characterIds: string[]
  createdAt: Date
  updatedAt: Date
}

export interface Page {
  id: string
  storyId: string
  kind: PageKind
  position: number
  text: string
  imagePrompt: string
  characterIds: string[]
  steeringText: string | null
  hidden: boolean
  selectedImageId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PageImage {
  id: string
  pageId: string
  url: string
  rawUrl: string | null
  promptUsed: string
  variant: number
  createdAt: Date
  updatedAt: Date
}

export interface Task {
  id: string
  userId: string
  storyId: string
  pageId: string | null
  type: TaskType
  status: TaskStatus
  error: string | null
  resultJson: unknown | null
  startedAt: Date | null
  finishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
