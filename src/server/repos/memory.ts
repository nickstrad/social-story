import type {
  Character,
  Page,
  PageImage,
  Rule,
  Story,
  Task,
} from "../domain/types"
import type { Repos } from "../ports/repos"

const newId = () => crypto.randomUUID()
const now = () => new Date()
const required = <T>(value: T | undefined, label: string): T => {
  if (!value) throw new Error(`${label} not found`)
  return value
}

export function inMemoryRepos(): Repos {
  const stories = new Map<string, Story>()
  const characters = new Map<string, Character>()
  const rules = new Map<string, Rule>()
  const pages = new Map<string, Page>()
  const images = new Map<string, PageImage>()
  const tasks = new Map<string, Task>()

  return {
    stories: {
      async create(input) {
        const timestamp = now()
        const value: Story = {
          id: newId(),
          status: "DRAFT",
          baseImageUrl: null,
          coverNote: null,
          ...input,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        stories.set(value.id, value)
        return value
      },
      async getById(id) {
        return stories.get(id) ?? null
      },
      async listByUser(userId) {
        return [...stories.values()].filter((item) => item.userId === userId)
      },
      async update(id, input) {
        const value = {
          ...required(stories.get(id), "Story"),
          ...input,
          updatedAt: now(),
        }
        stories.set(id, value)
        return value
      },
      async delete(id) {
        stories.delete(id)
        for (const [key, value] of characters)
          if (value.storyId === id) characters.delete(key)
        for (const [key, value] of rules)
          if (value.storyId === id) rules.delete(key)
        for (const [key, value] of pages)
          if (value.storyId === id) pages.delete(key)
        for (const [key, value] of tasks)
          if (value.storyId === id) tasks.delete(key)
      },
    },
    characters: {
      async create(input) {
        const timestamp = now()
        const value: Character = {
          id: newId(),
          role: null,
          age: null,
          appearance: null,
          photoUrl: null,
          photoDescription: null,
          ...input,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        characters.set(value.id, value)
        return value
      },
      async getById(id) {
        return characters.get(id) ?? null
      },
      async listByStory(storyId) {
        return [...characters.values()].filter(
          (item) => item.storyId === storyId
        )
      },
      async update(id, input) {
        const value = {
          ...required(characters.get(id), "Character"),
          ...input,
          updatedAt: now(),
        }
        characters.set(id, value)
        return value
      },
      async delete(id) {
        characters.delete(id)
      },
    },
    rules: {
      async create(input) {
        const timestamp = now()
        const value = {
          id: newId(),
          ...input,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        rules.set(value.id, value)
        return value
      },
      async getById(id) {
        return rules.get(id) ?? null
      },
      async listByStory(storyId) {
        return [...rules.values()].filter((item) => item.storyId === storyId)
      },
      async update(id, input) {
        const value = {
          ...required(rules.get(id), "Rule"),
          ...input,
          updatedAt: now(),
        }
        rules.set(id, value)
        return value
      },
      async delete(id) {
        rules.delete(id)
      },
    },
    pages: {
      async create(input) {
        const timestamp = now()
        const value: Page = {
          id: newId(),
          steeringText: null,
          hidden: false,
          selectedImageId: null,
          ...input,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        pages.set(value.id, value)
        return value
      },
      async getById(id) {
        return pages.get(id) ?? null
      },
      async listByStory(storyId) {
        return [...pages.values()]
          .filter((item) => item.storyId === storyId)
          .sort((a, b) => a.position - b.position)
      },
      async replaceAll(storyId, newPages) {
        for (const [key, value] of pages)
          if (value.storyId === storyId) pages.delete(key)
        for (const input of newPages) {
          const timestamp = now()
          const value: Page = {
            id: newId(),
            steeringText: null,
            hidden: false,
            selectedImageId: null,
            ...input,
            storyId,
            createdAt: timestamp,
            updatedAt: timestamp,
          }
          pages.set(value.id, value)
        }
        return [...pages.values()]
          .filter((item) => item.storyId === storyId)
          .sort((a, b) => a.position - b.position)
      },
      async update(id, input) {
        const value = {
          ...required(pages.get(id), "Page"),
          ...input,
          updatedAt: now(),
        }
        pages.set(id, value)
        return value
      },
      async updateOrder(storyId, orderedIds) {
        orderedIds.forEach((id, position) => {
          const page = pages.get(id)
          if (page?.storyId === storyId)
            pages.set(id, { ...page, position, updatedAt: now() })
        })
        return [...pages.values()]
          .filter((item) => item.storyId === storyId)
          .sort((a, b) => a.position - b.position)
      },
      async delete(id) {
        pages.delete(id)
        for (const [key, value] of images)
          if (value.pageId === id) images.delete(key)
      },
      async addImage(input) {
        const timestamp = now()
        const value = {
          id: newId(),
          rawUrl: null,
          ...input,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        images.set(value.id, value)
        return value
      },
      async listImages(pageId) {
        return [...images.values()]
          .filter((item) => item.pageId === pageId)
          .sort((a, b) => a.variant - b.variant)
      },
      async listImagesByStory(storyId) {
        const storyPageIds = new Set(
          [...pages.values()]
            .filter((page) => page.storyId === storyId)
            .map((page) => page.id)
        )
        return [...images.values()]
          .filter((item) => storyPageIds.has(item.pageId))
          .sort((a, b) => a.variant - b.variant)
      },
    },
    tasks: {
      async create(input) {
        const timestamp = now()
        const value: Task = {
          id: newId(),
          pageId: null,
          status: "PENDING",
          error: null,
          resultJson: null,
          startedAt: null,
          finishedAt: null,
          ...input,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        tasks.set(value.id, value)
        return value
      },
      async getById(id) {
        return tasks.get(id) ?? null
      },
      async listByStory(storyId) {
        return [...tasks.values()].filter((item) => item.storyId === storyId)
      },
      async claimPending(id, startedAt) {
        const task = tasks.get(id)
        if (!task || task.status !== "PENDING") return null
        const value: Task = {
          ...task,
          status: "RUNNING",
          startedAt,
          updatedAt: now(),
        }
        tasks.set(id, value)
        return value
      },
      async update(id, input) {
        const value = {
          ...required(tasks.get(id), "Task"),
          ...input,
          updatedAt: now(),
        }
        tasks.set(id, value)
        return value
      },
    },
  }
}
