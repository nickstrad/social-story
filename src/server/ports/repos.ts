import type {
  Character,
  CreateCharacter,
  CreatePage,
  CreatePageImage,
  CreateRule,
  CreateStory,
  CreateTask,
  Page,
  PageImage,
  Rule,
  Story,
  Task,
  UpdateCharacter,
  UpdatePage,
  UpdateRule,
  UpdateStory,
  UpdateTask,
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
  update(id: string, input: UpdateCharacter): Promise<Character>
  delete(id: string): Promise<void>
}

export interface RuleRepo {
  create(input: CreateRule): Promise<Rule>
  listByStory(storyId: string): Promise<Rule[]>
  update(id: string, input: UpdateRule): Promise<Rule>
  delete(id: string): Promise<void>
}

export interface PageRepo {
  create(input: CreatePage): Promise<Page>
  getById(id: string): Promise<Page | null>
  listByStory(storyId: string): Promise<Page[]>
  update(id: string, input: UpdatePage): Promise<Page>
  updateOrder(storyId: string, orderedIds: string[]): Promise<Page[]>
  delete(id: string): Promise<void>
  addImage(input: CreatePageImage): Promise<PageImage>
  listImages(pageId: string): Promise<PageImage[]>
}

export interface TaskRepo {
  create(input: CreateTask): Promise<Task>
  getById(id: string): Promise<Task | null>
  listByStory(storyId: string): Promise<Task[]>
  claimPending(id: string, startedAt: Date): Promise<Task | null>
  update(id: string, input: UpdateTask): Promise<Task>
}

export interface Repos {
  stories: StoryRepo
  characters: CharacterRepo
  rules: RuleRepo
  pages: PageRepo
  tasks: TaskRepo
}
