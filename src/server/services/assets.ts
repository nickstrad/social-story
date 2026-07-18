import type { Deps } from "@/server/container"
import type {
  Asset,
  AssetKind,
  Character,
  LibraryCharacter,
  PageImage,
  Story,
} from "@/server/domain/types"
import type { Repos } from "@/server/ports/repos"

export const BROWSER_ASSET_KINDS = [
  "BASE_IMAGE",
  "CHARACTER_PHOTO",
  "LIBRARY_PHOTO",
  "PAGE_IMAGE",
  "PDF",
] as const satisfies readonly AssetKind[]

export const assetUrl = (assetId: string) =>
  `/api/me/assets/${encodeURIComponent(assetId)}`

export const clientStory = (story: Story) => ({
  ...story,
  baseImageUrl: story.baseImageAssetId
    ? assetUrl(story.baseImageAssetId)
    : null,
})

export const clientCharacter = (character: Character) => ({
  ...character,
  photoUrl: character.photoAssetId ? assetUrl(character.photoAssetId) : null,
})

export const clientLibraryCharacter = (character: LibraryCharacter) => ({
  ...character,
  photoUrl: character.photoAssetId ? assetUrl(character.photoAssetId) : null,
})

export const clientPageImage = (image: PageImage) => ({
  ...image,
  url: assetUrl(image.imageAssetId),
})

interface AssetUpload {
  userId: string
  storyId: string | null
  kind: AssetKind
  key: string
  data: Buffer
  contentType: string
  filename?: string
}

async function uploadBlob(deps: Deps, input: AssetUpload) {
  const { locator } = await deps.storage.put(
    input.key,
    input.data,
    input.contentType
  )
  return {
    userId: input.userId,
    storyId: input.storyId,
    kind: input.kind,
    storageLocator: locator,
    contentType: input.contentType,
    byteLength: input.data.byteLength,
    filename: input.filename,
  }
}

async function deleteBestEffort(deps: Deps, locator?: string | null) {
  if (locator) await deps.storage.delete(locator).catch(() => undefined)
}

export async function createAsset(
  deps: Deps,
  input: AssetUpload
): Promise<Asset> {
  const uploaded = await uploadBlob(deps, input)
  try {
    return await deps.repos.assets.create(uploaded)
  } catch (error) {
    await deleteBestEffort(deps, uploaded.storageLocator)
    throw error
  }
}

async function replaceAssetReference(
  deps: Deps,
  input: AssetUpload,
  previousAssetId: string | null,
  updateReference: (repos: Repos, assetId: string) => Promise<unknown>
): Promise<Asset> {
  const uploaded = await uploadBlob(deps, input)
  try {
    const { asset, oldAsset } = await deps.repos.transaction(async (repos) => {
      const created = await repos.assets.create(uploaded)
      await updateReference(repos, created.id)
      let previous: Asset | null = null
      if (previousAssetId) {
        previous = await repos.assets.getById(previousAssetId)
        if (previous) await repos.assets.delete(previousAssetId)
      }
      return { asset: created, oldAsset: previous }
    })
    await deleteBestEffort(deps, oldAsset?.storageLocator)
    return asset
  } catch (error) {
    await deleteBestEffort(deps, uploaded.storageLocator)
    throw error
  }
}

export function replaceStoryBaseAsset(
  deps: Deps,
  story: Story,
  data: Buffer,
  key: string
) {
  return replaceAssetReference(
    deps,
    {
      userId: story.userId,
      storyId: story.id,
      kind: "BASE_IMAGE",
      key,
      data,
      contentType: "image/png",
    },
    story.baseImageAssetId,
    (repos, assetId) =>
      repos.stories.update(story.id, { baseImageAssetId: assetId })
  )
}

export function replaceCharacterPhotoAsset(
  deps: Deps,
  story: Story,
  character: Character,
  data: Buffer,
  key: string
) {
  return replaceAssetReference(
    deps,
    {
      userId: story.userId,
      storyId: story.id,
      kind: "CHARACTER_PHOTO",
      key,
      data,
      contentType: "image/png",
    },
    character.photoAssetId,
    (repos, assetId) =>
      repos.characters.update(character.id, { photoAssetId: assetId })
  )
}

export function replaceLibraryPhotoAsset(
  deps: Deps,
  character: LibraryCharacter,
  data: Buffer,
  key: string
) {
  return replaceAssetReference(
    deps,
    {
      userId: character.userId,
      storyId: null,
      kind: "LIBRARY_PHOTO",
      key,
      data,
      contentType: "image/png",
    },
    character.photoAssetId,
    (repos, assetId) =>
      repos.libraryCharacters.update(character.id, { photoAssetId: assetId })
  )
}

export async function copyAsset(
  deps: Deps,
  source: Asset,
  targetKey: string,
  target: { storyId: string | null; kind: AssetKind }
): Promise<Asset> {
  const data = await deps.storage.fetchBuffer(source.storageLocator)
  return createAsset(deps, {
    userId: source.userId,
    storyId: target.storyId,
    kind: target.kind,
    key: targetKey,
    data,
    contentType: source.contentType,
    filename: source.filename ?? undefined,
  })
}

export async function createPageImageAssets(
  deps: Deps,
  input: {
    userId: string
    storyId: string
    pageId: string
    promptUsed: string
    variant: number
    raw: Buffer
    captioned: Buffer
    rawKey: string
    captionedKey: string
  }
): Promise<PageImage> {
  const raw = await uploadBlob(deps, {
    userId: input.userId,
    storyId: input.storyId,
    kind: "PAGE_IMAGE_RAW",
    key: input.rawKey,
    data: input.raw,
    contentType: "image/png",
  })
  let captioned: Awaited<ReturnType<typeof uploadBlob>>
  try {
    captioned = await uploadBlob(deps, {
      userId: input.userId,
      storyId: input.storyId,
      kind: "PAGE_IMAGE",
      key: input.captionedKey,
      data: input.captioned,
      contentType: "image/png",
    })
  } catch (error) {
    await deleteBestEffort(deps, raw.storageLocator)
    throw error
  }

  try {
    return await deps.repos.transaction(async (repos) => {
      const rawAsset = await repos.assets.create(raw)
      const imageAsset = await repos.assets.create(captioned)
      const image = await repos.pages.addImage({
        pageId: input.pageId,
        imageAssetId: imageAsset.id,
        rawAssetId: rawAsset.id,
        promptUsed: input.promptUsed,
        variant: input.variant,
      })
      await repos.pages.update(input.pageId, { selectedImageId: image.id })
      return image
    })
  } catch (error) {
    await Promise.all([
      deleteBestEffort(deps, raw.storageLocator),
      deleteBestEffort(deps, captioned.storageLocator),
    ])
    throw error
  }
}

export async function fetchAssetBuffer(deps: Deps, assetId: string) {
  const asset = await deps.repos.assets.getById(assetId)
  if (!asset) throw new Error(`Asset not found: ${assetId}`)
  return deps.storage.fetchBuffer(asset.storageLocator)
}
