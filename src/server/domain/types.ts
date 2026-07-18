export type StoryStatus = "DRAFT" | "PARSED" | "READY"
export type RuleKind =
  "TOGETHER" | "ALWAYS_INCLUDE" | "NEVER_INCLUDE" | "FREEFORM"
export type PageKind = "COVER" | "PAGE"
export type TaskType =
  "PARSE_STORY" | "BASE_IMAGE" | "PAGE_IMAGE" | "PDF_EXPORT"
export type TaskStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED"
export type AssetKind =
  | "BASE_IMAGE"
  | "CHARACTER_PHOTO"
  | "LIBRARY_PHOTO"
  | "PAGE_IMAGE"
  | "PAGE_IMAGE_RAW"
  | "PDF"
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export interface Story {
  id: string
  userId: string
  title: string
  script: string
  status: StoryStatus
  baseImageAssetId: string | null
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
  photoAssetId: string | null
  photoDescription: string | null
  libraryCharacterId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface LibraryCharacter {
  id: string
  userId: string
  name: string
  role: string | null
  age: string | null
  appearance: string | null
  photoAssetId: string | null
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
  imageAssetId: string
  rawAssetId: string | null
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

/** Server-only persistence type. Never return this object through an API. */
export interface Asset {
  id: string
  userId: string
  storyId: string | null
  kind: AssetKind
  storageLocator: string
  contentType: string
  byteLength: number
  filename: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ClientStory extends Story {
  baseImageUrl: string | null
}

export interface ClientCharacter extends Character {
  photoUrl: string | null
}

export interface ClientLibraryCharacter extends LibraryCharacter {
  photoUrl: string | null
}

export interface ClientPageImage extends PageImage {
  url: string
}

export type CreateStory = Pick<Story, "userId" | "title" | "script"> &
  Partial<Pick<Story, "status" | "baseImageAssetId" | "coverNote">>
export type UpdateStory = Partial<
  Pick<Story, "title" | "script" | "status" | "baseImageAssetId" | "coverNote">
>
export type CreateCharacter = Pick<Character, "storyId" | "name"> &
  Partial<
    Pick<
      Character,
      | "role"
      | "age"
      | "appearance"
      | "photoAssetId"
      | "photoDescription"
      | "libraryCharacterId"
    >
  >
export type UpdateCharacter = Partial<
  Pick<
    Character,
    | "name"
    | "role"
    | "age"
    | "appearance"
    | "photoAssetId"
    | "photoDescription"
    | "libraryCharacterId"
  >
>
export type CreateLibraryCharacter = Pick<LibraryCharacter, "userId" | "name"> &
  Partial<
    Pick<
      LibraryCharacter,
      "role" | "age" | "appearance" | "photoAssetId" | "photoDescription"
    >
  >
export type UpdateLibraryCharacter = Partial<
  Pick<
    LibraryCharacter,
    "name" | "role" | "age" | "appearance" | "photoAssetId" | "photoDescription"
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
  "pageId" | "imageAssetId" | "promptUsed" | "variant"
> &
  Partial<Pick<PageImage, "rawAssetId">>
export type CreateAsset = Pick<
  Asset,
  | "userId"
  | "storyId"
  | "kind"
  | "storageLocator"
  | "contentType"
  | "byteLength"
> &
  Partial<Pick<Asset, "filename">>
export type UpdateAsset = Partial<
  Pick<
    Asset,
    "kind" | "storageLocator" | "contentType" | "byteLength" | "filename"
  >
>
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
