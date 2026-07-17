import type {
  Asset,
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

function byStoryIds<T extends { storyId: string }>(
  values: Iterable<T>,
  storyIds: string[]
): T[] {
  const wanted = new Set(storyIds)
  return [...values].filter((value) => wanted.has(value.storyId))
}

export function inMemoryRepos(): Repos {
  const stories = new Map<string, Story>()
  const characters = new Map<string, Character>()
  const rules = new Map<string, Rule>()
  const pages = new Map<string, Page>()
  const images = new Map<string, PageImage>()
  const tasks = new Map<string, Task>()
  const assets = new Map<string, Asset>()
  const pagesByStoryIds = (storyIds: string[]) =>
    byStoryIds(pages.values(), storyIds).sort((a, b) => a.position - b.position)
  const pageImagesByStoryIds = (storyIds: string[]) => {
    const pageIds = new Set(pagesByStoryIds(storyIds).map((page) => page.id))
    return [...images.values()]
      .filter((image) => pageIds.has(image.pageId))
      .sort((a, b) => a.variant - b.variant)
  }

  const repos: Repos = {
    stories: {
      async create(input) {
        const timestamp = now()
        const value: Story = {
          id: newId(),
          status: "DRAFT",
          baseImageAssetId: null,
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
        for (const [key, value] of assets)
          if (value.storyId === id) assets.delete(key)
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
          photoAssetId: null,
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
        return byStoryIds(characters.values(), [storyId])
      },
      async listByStoryIds(storyIds) {
        return byStoryIds(characters.values(), storyIds)
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
        return pagesByStoryIds([storyId])
      },
      async listByStoryIds(storyIds) {
        return pagesByStoryIds(storyIds)
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
        return pagesByStoryIds([storyId])
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
        return pagesByStoryIds([storyId])
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
          rawAssetId: null,
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
        return pageImagesByStoryIds([storyId])
      },
      async listImagesByStoryIds(storyIds) {
        return pageImagesByStoryIds(storyIds)
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
        return byStoryIds(tasks.values(), [storyId])
      },
      async listByStoryIds(storyIds) {
        return byStoryIds(tasks.values(), storyIds)
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
      async completeRunning(id, input) {
        const task = tasks.get(id)
        if (!task || task.status !== "RUNNING") return null
        const value: Task = {
          ...task,
          ...input,
          status: "SUCCEEDED",
          updatedAt: now(),
        }
        tasks.set(id, value)
        return value
      },
      async failActive(id, error, finishedAt) {
        const task = tasks.get(id)
        if (!task || (task.status !== "PENDING" && task.status !== "RUNNING")) {
          return null
        }
        const value: Task = {
          ...task,
          status: "FAILED",
          error,
          finishedAt,
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
    assets: {
      async create(input) {
        const story = stories.get(input.storyId)
        if (!story || story.userId !== input.userId) {
          throw new Error("Asset owner must match story owner")
        }
        if (
          [...assets.values()].some(
            (asset) => asset.storageLocator === input.storageLocator
          )
        ) {
          throw new Error("Asset storage locator must be unique")
        }
        const timestamp = now()
        const value: Asset = {
          id: newId(),
          filename: null,
          ...input,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        assets.set(value.id, value)
        return value
      },
      async getById(id) {
        return assets.get(id) ?? null
      },
      async getOwnedById(id, userId, kinds) {
        const asset = assets.get(id)
        if (!asset || asset.userId !== userId) return null
        if (kinds && !kinds.includes(asset.kind)) return null
        return asset
      },
      async listByIds(ids) {
        const wanted = new Set(ids)
        return [...assets.values()].filter((asset) => wanted.has(asset.id))
      },
      async listByStory(storyId) {
        return byStoryIds(assets.values(), [storyId])
      },
      async listByStoryIds(storyIds) {
        return byStoryIds(assets.values(), storyIds)
      },
      async update(id, input) {
        const value = {
          ...required(assets.get(id), "Asset"),
          ...input,
          updatedAt: now(),
        }
        assets.set(id, value)
        return value
      },
      async delete(id) {
        assets.delete(id)
      },
    },
    async transaction(work) {
      const snapshots = {
        stories: new Map(stories),
        characters: new Map(characters),
        rules: new Map(rules),
        pages: new Map(pages),
        images: new Map(images),
        tasks: new Map(tasks),
        assets: new Map(assets),
      }
      try {
        return await work(repos)
      } catch (error) {
        const restore = <T>(target: Map<string, T>, source: Map<string, T>) => {
          target.clear()
          for (const [key, value] of source) target.set(key, value)
        }
        restore(stories, snapshots.stories)
        restore(characters, snapshots.characters)
        restore(rules, snapshots.rules)
        restore(pages, snapshots.pages)
        restore(images, snapshots.images)
        restore(tasks, snapshots.tasks)
        restore(assets, snapshots.assets)
        throw error
      }
    },
  }
  return repos
}
