import type {
  Asset,
  AssetKind,
  Character,
  CreateAsset,
  CreateCharacter,
  CreateLibraryCharacter,
  CreatePage,
  CreatePageImage,
  CreateRule,
  CreateStory,
  CreateTask,
  Page,
  PageImage,
  LibraryCharacter,
  Rule,
  Story,
  Task,
  UpdateCharacter,
  UpdateLibraryCharacter,
  UpdatePage,
  UpdateRule,
  UpdateStory,
  UpdateTask,
  UpdateAsset,
} from "../domain/types"

export interface StoryRepo {
  create(input: CreateStory): Promise<Story>
  getById(id: string): Promise<Story | null>
  listByUser(userId: string): Promise<Story[]>
  update(id: string, input: UpdateStory): Promise<Story>
  delete(id: string): Promise<void>
}

export interface CharacterRepo {
  create(input: CreateCharacter): Promise<Character>
  getById(id: string): Promise<Character | null>
  listByStory(storyId: string): Promise<Character[]>
  listByStoryIds(storyIds: string[]): Promise<Character[]>
  update(id: string, input: UpdateCharacter): Promise<Character>
  delete(id: string): Promise<void>
}

export interface LibraryCharacterRepo {
  create(input: CreateLibraryCharacter): Promise<LibraryCharacter>
  getOwnedById(id: string, userId: string): Promise<LibraryCharacter | null>
  listByUser(userId: string): Promise<LibraryCharacter[]>
  update(id: string, input: UpdateLibraryCharacter): Promise<LibraryCharacter>
  delete(id: string): Promise<void>
}

export interface RuleRepo {
  create(input: CreateRule): Promise<Rule>
  getById(id: string): Promise<Rule | null>
  listByStory(storyId: string): Promise<Rule[]>
  update(id: string, input: UpdateRule): Promise<Rule>
  delete(id: string): Promise<void>
}

export interface PageRepo {
  create(input: CreatePage): Promise<Page>
  getById(id: string): Promise<Page | null>
  listByStory(storyId: string): Promise<Page[]>
  listByStoryIds(storyIds: string[]): Promise<Page[]>
  replaceAll(
    storyId: string,
    pages: Omit<CreatePage, "storyId">[]
  ): Promise<Page[]>
  update(id: string, input: UpdatePage): Promise<Page>
  updateOrder(storyId: string, orderedIds: string[]): Promise<Page[]>
  delete(id: string): Promise<void>
  addImage(input: CreatePageImage): Promise<PageImage>
  listImages(pageId: string): Promise<PageImage[]>
  listImagesByStory(storyId: string): Promise<PageImage[]>
  listImagesByStoryIds(storyIds: string[]): Promise<PageImage[]>
}

export interface TaskRepo {
  create(input: CreateTask): Promise<Task>
  getById(id: string): Promise<Task | null>
  listByStory(storyId: string): Promise<Task[]>
  listByStoryIds(storyIds: string[]): Promise<Task[]>
  claimPending(id: string, startedAt: Date): Promise<Task | null>
  completeRunning(
    id: string,
    input: Pick<UpdateTask, "resultJson" | "finishedAt">
  ): Promise<Task | null>
  failActive(id: string, error: string, finishedAt: Date): Promise<Task | null>
  update(id: string, input: UpdateTask): Promise<Task>
}

export interface AssetRepo {
  create(input: CreateAsset): Promise<Asset>
  getById(id: string): Promise<Asset | null>
  getOwnedById(
    id: string,
    userId: string,
    kinds?: readonly AssetKind[]
  ): Promise<Asset | null>
  listByIds(ids: string[]): Promise<Asset[]>
  listByStory(storyId: string): Promise<Asset[]>
  listByStoryIds(storyIds: string[]): Promise<Asset[]>
  update(id: string, input: UpdateAsset): Promise<Asset>
  delete(id: string): Promise<void>
}

export interface Repos {
  stories: StoryRepo
  characters: CharacterRepo
  libraryCharacters: LibraryCharacterRepo
  rules: RuleRepo
  pages: PageRepo
  tasks: TaskRepo
  assets: AssetRepo
  transaction<T>(work: (repos: Repos) => Promise<T>): Promise<T>
}
