// Blob layout:
// stories/{storyId}/photos/{characterId}.png
// stories/{storyId}/base.png
// stories/{storyId}/pages/{pageId}/v{n}.png
// stories/{storyId}/story.pdf
export const photoKey = (storyId: string, characterId: string) =>
  `stories/${storyId}/photos/${characterId}.png`

export const baseImageKey = (storyId: string) => `stories/${storyId}/base.png`

export const pageImageKey = (
  storyId: string,
  pageId: string,
  variant: number
) => `stories/${storyId}/pages/${pageId}/v${variant}.png`

export const storyPdfKey = (storyId: string) => `stories/${storyId}/story.pdf`
