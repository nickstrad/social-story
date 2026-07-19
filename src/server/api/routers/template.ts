import { TRPCError } from "@trpc/server"
import { z } from "zod"

import {
  assertStoryOwnership,
  assertTemplateUsable,
} from "@/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import {
  buildInstantiation,
  type InstantiationPlan,
} from "@/server/domain/instantiate"
import type { Deps } from "@/server/container"
import type { Character, LibraryCharacter } from "@/server/domain/types"
import {
  clientCharacter,
  clientStory,
  copyAsset,
} from "@/server/services/assets"
import { photoKey } from "@/server/services/storage-keys"
import { storyListParamsSchema } from "@/lib/validation/listParams"

const titleSchema = z.string().trim().min(1).max(200)
const castEntrySchema = z
  .object({
    templateCharacterId: z.string().min(1),
    name: z.string().trim().max(100),
    include: z.boolean(),
    libraryCharacterId: z.string().min(1).optional(),
  })
  .superRefine((entry, ctx) => {
    if (entry.include && !entry.name) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "Name is required for included cast members",
      })
    }
  })

type CastEntry = z.infer<typeof castEntrySchema>

async function loadTemplateRows(
  repos: Parameters<typeof assertTemplateUsable>[0],
  story: Awaited<ReturnType<typeof assertTemplateUsable>>
) {
  const [characters, rules, pages] = await Promise.all([
    repos.characters.listByStory(story.id),
    repos.rules.listByStory(story.id),
    repos.pages.listByStory(story.id),
  ])
  return { story, characters, rules, pages }
}

async function persistPlan(
  repos: Parameters<typeof assertTemplateUsable>[0],
  userId: string,
  plan: InstantiationPlan
) {
  return repos.transaction(async (tx) => {
    const story = await tx.stories.create({ userId, ...plan.story })
    await tx.characters.createMany(
      plan.characters.map(({ templateCharacterId, ...character }) => {
        if (!templateCharacterId)
          throw new Error("Missing template character id")
        return { ...character, storyId: story.id }
      })
    )
    for (const rule of plan.rules) {
      await tx.rules.create({ ...rule, storyId: story.id })
    }
    await tx.pages.replaceAll(story.id, plan.pages)
    return story
  })
}

function validateCast(templateCharacters: Character[], cast: CastEntry[]) {
  const known = new Map(
    templateCharacters.map((character) => [character.id, character])
  )
  const seen = new Set<string>()
  for (const entry of cast) {
    if (
      !known.has(entry.templateCharacterId) ||
      seen.has(entry.templateCharacterId)
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid template cast",
      })
    }
    seen.add(entry.templateCharacterId)
  }
  if (!cast.some((entry) => entry.include)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Include at least one cast member",
    })
  }
  const included = new Set(
    cast
      .filter((entry) => entry.include)
      .map((entry) => entry.templateCharacterId)
  )
  if (
    templateCharacters.some(
      (character) => !character.isOptional && !included.has(character.id)
    )
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Every required template slot must be included",
    })
  }
}

async function loadLibrarySelections(
  repos: Parameters<typeof assertTemplateUsable>[0],
  userId: string,
  cast: CastEntry[]
) {
  const selected = cast.filter(
    (entry) => entry.include && entry.libraryCharacterId
  )
  const rows = await Promise.all(
    selected.map((entry) =>
      repos.libraryCharacters.getOwnedById(entry.libraryCharacterId!, userId)
    )
  )
  if (rows.some((row) => !row)) throw new TRPCError({ code: "NOT_FOUND" })
  const characters = rows as LibraryCharacter[]
  const photos = await Promise.all(
    characters.map((character) =>
      character.photoAssetId
        ? repos.assets.getOwnedById(character.photoAssetId, userId, [
            "LIBRARY_PHOTO",
          ])
        : null
    )
  )
  if (
    characters.some(
      (character, index) => character.photoAssetId && !photos[index]
    )
  ) {
    throw new TRPCError({ code: "NOT_FOUND" })
  }
  return new Map(
    selected.map((entry, index) => [
      entry.templateCharacterId,
      {
        character: characters[index],
        photo: photos[index] ?? null,
      },
    ])
  )
}

async function deleteFailedInstance(deps: Deps, storyId: string) {
  const assets = await deps.repos.transaction(async (repos) => {
    const storyAssets = await repos.assets.listByStory(storyId)
    const pages = await repos.pages.listByStory(storyId)
    for (const page of pages) await repos.pages.delete(page.id)
    for (const asset of storyAssets) await repos.assets.delete(asset.id)
    await repos.stories.delete(storyId)
    return storyAssets
  })
  await Promise.all(
    assets.map((asset) =>
      deps.storage.delete(asset.storageLocator).catch(() => undefined)
    )
  )
}

export const templateRouter = createTRPCRouter({
  list: protectedProcedure
    .input(storyListParamsSchema)
    .query(async ({ ctx, input }) => {
      const candidatesPage = await ctx.deps.repos.stories.listByUserPaged(
        ctx.session.user.id,
        "TEMPLATE",
        input
      )
      const templates = await Promise.all(
        candidatesPage.items.map((candidate) =>
          assertTemplateUsable(ctx.deps.repos, candidate, ctx.session.user.id)
        )
      )
      const ids = templates.map((template) => template.id)
      const [characters, pages] = await Promise.all([
        ctx.deps.repos.characters.listByStoryIds(ids),
        ctx.deps.repos.pages.listByStoryIds(ids),
      ])
      const countByStory = (rows: Array<{ storyId: string }>) => {
        const counts = new Map<string, number>()
        for (const row of rows) {
          counts.set(row.storyId, (counts.get(row.storyId) ?? 0) + 1)
        }
        return counts
      }
      const characterCounts = countByStory(characters)
      const pageCounts = countByStory(pages)
      return {
        items: templates.map((template) => ({
          ...clientStory(template),
          counts: {
            characters: characterCounts.get(template.id) ?? 0,
            pages: pageCounts.get(template.id) ?? 0,
          },
        })),
        nextCursor: candidatesPage.nextCursor,
      }
    }),

  getForUse: protectedProcedure
    .input(z.object({ templateId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const template = await assertTemplateUsable(
        ctx.deps.repos,
        input.templateId,
        ctx.session.user.id
      )
      return {
        id: template.id,
        title: template.title,
        characters: (
          await ctx.deps.repos.characters.listByStory(template.id)
        ).map(clientCharacter),
      }
    }),

  createFromStory: protectedProcedure
    .input(
      z.object({ storyId: z.string().min(1), title: titleSchema.optional() })
    )
    .mutation(async ({ ctx, input }) => {
      const source = await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      if (source.kind !== "STORY") throw new TRPCError({ code: "BAD_REQUEST" })
      const template = await loadTemplateRows(ctx.deps.repos, source)
      const plan = buildInstantiation(template, {
        title: input.title ?? source.title,
        cast: template.characters.map((character) => ({
          templateCharacterId: character.id,
          name: character.name,
          include: true,
        })),
      })
      const sourceById = new Map(
        template.characters.map((character) => [character.id, character])
      )
      plan.story.kind = "TEMPLATE"
      plan.story.templateId = null
      plan.characters = plan.characters.map((character) => ({
        ...character,
        appearance:
          sourceById.get(character.templateCharacterId)?.appearance ?? null,
      }))
      const created = await persistPlan(
        ctx.deps.repos,
        ctx.session.user.id,
        plan
      )
      return { storyId: created.id }
    }),

  instantiate: protectedProcedure
    .input(
      z.object({
        templateId: z.string().min(1),
        title: titleSchema,
        cast: z.array(castEntrySchema).min(1).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const story = await assertTemplateUsable(
        ctx.deps.repos,
        input.templateId,
        ctx.session.user.id
      )
      const template = await loadTemplateRows(ctx.deps.repos, story)
      validateCast(template.characters, input.cast)
      const libraryByTemplateId = await loadLibrarySelections(
        ctx.deps.repos,
        ctx.session.user.id,
        input.cast
      )
      const plan = buildInstantiation(template, input)
      const created = await persistPlan(
        ctx.deps.repos,
        ctx.session.user.id,
        plan
      )

      try {
        for (const planned of plan.characters) {
          const selection = libraryByTemplateId.get(planned.templateCharacterId)
          if (!selection) continue
          const { character: libraryCharacter, photo: sourcePhoto } = selection
          await ctx.deps.repos.characters.update(planned.id!, {
            appearance: libraryCharacter.appearance,
            photoDescription: libraryCharacter.photoDescription,
            libraryCharacterId: libraryCharacter.id,
          })
          if (!sourcePhoto) continue
          const photo = await copyAsset(
            ctx.deps,
            sourcePhoto,
            photoKey(created.id, planned.id!),
            { storyId: created.id, kind: "CHARACTER_PHOTO" }
          )
          await ctx.deps.repos.characters.update(planned.id!, {
            photoAssetId: photo.id,
          })
        }
      } catch (error) {
        await deleteFailedInstance(ctx.deps, created.id)
        throw error
      }

      return { storyId: created.id }
    }),
})
