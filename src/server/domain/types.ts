export type StoryStatus = "DRAFT" | "PARSED" | "READY"
export type RuleKind =
  "TOGETHER" | "ALWAYS_INCLUDE" | "NEVER_INCLUDE" | "FREEFORM"
export type PageKind = "COVER" | "PAGE"
export type TaskType =
  "PARSE_STORY" | "BASE_IMAGE" | "PAGE_IMAGE" | "PDF_EXPORT"
export type TaskStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED"
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

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

export interface Task {
  id: string
  userId: string
  storyId: string
  pageId: string | null
  type: TaskType
  status: TaskStatus
  error: string | null
  resultJson: JsonValue | null
  startedAt: Date | null
  finishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type CreateStory = Pick<Story, "userId" | "title" | "script"> &
  Partial<Pick<Story, "status" | "baseImageUrl" | "coverNote">>
export type UpdateStory = Partial<
  Pick<Story, "title" | "script" | "status" | "baseImageUrl" | "coverNote">
>
export type CreateCharacter = Pick<Character, "storyId" | "name"> &
  Partial<
    Pick<
      Character,
      "role" | "age" | "appearance" | "photoUrl" | "photoDescription"
    >
  >
export type UpdateCharacter = Partial<
  Pick<
    Character,
    "name" | "role" | "age" | "appearance" | "photoUrl" | "photoDescription"
  >
>
export type CreateRule = Pick<
  Rule,
  "storyId" | "text" | "kind" | "characterIds"
>
export type UpdateRule = Partial<Pick<Rule, "text" | "kind" | "characterIds">>
export type CreatePage = Pick<
  Page,
  "storyId" | "kind" | "position" | "text" | "imagePrompt" | "characterIds"
> &
  Partial<Pick<Page, "steeringText" | "hidden">>
export type UpdatePage = Partial<
  Pick<
    Page,
    | "kind"
    | "position"
    | "text"
    | "imagePrompt"
    | "characterIds"
    | "steeringText"
    | "hidden"
    | "selectedImageId"
  >
>
export type CreatePageImage = Pick<
  PageImage,
  "pageId" | "url" | "promptUsed" | "variant"
> &
  Partial<Pick<PageImage, "rawUrl">>
export type CreateTask = Pick<Task, "userId" | "storyId" | "type"> &
  Partial<
    Pick<
      Task,
      "pageId" | "status" | "error" | "resultJson" | "startedAt" | "finishedAt"
    >
  >
export type UpdateTask = Partial<
  Pick<Task, "status" | "error" | "resultJson" | "startedAt" | "finishedAt">
>
