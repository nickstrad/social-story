import { readFileSync } from "node:fs"
import path from "node:path"

// Static fixtures for the Playwright E2E fake adapters. Loaded lazily from disk
// (only when E2E_FAKES=1) so the real server build never touches them. Paths are
// resolved from the repo root — `next start` runs with cwd at the project root.
const fixturesDir = path.join(process.cwd(), "e2e", "fixtures")

let parseResult: unknown
const images = new Map<string, Buffer>()

/**
 * Canned structured parse output the fake text generator returns for the single
 * PARSE_STORY text task. Kept in `e2e/fixtures/parse-result.json` so specs and
 * server share one source of truth for the expected pages.
 */
export function parseFixture(): unknown {
  parseResult ??= JSON.parse(
    readFileSync(path.join(fixturesDir, "parse-result.json"), "utf8")
  )
  return parseResult
}

function readImage(name: string): Buffer {
  let image = images.get(name)
  if (!image) {
    image = readFileSync(path.join(fixturesDir, "images", name))
    images.set(name, image)
  }
  return Buffer.from(image)
}

/**
 * Select a realistic, byte-stable image response by the prompt emitted by the
 * real task handler. Unknown prompts fail loudly so new image flows cannot
 * silently receive an unrelated fixture.
 */
export function baseImageFixture(): Buffer {
  return readImage("base-image.png")
}

export function coverImageFixture(): Buffer {
  return readImage("cover.png")
}

export function pageImageFixture(scene: string): Buffer {
  if (scene.includes("sits calmly in the dental chair"))
    return readImage("page-1.png")
  if (scene.includes("dentist gently counts")) return readImage("page-2.png")
  if (scene.includes("leaves the dental clinic")) return readImage("page-3.png")
  throw new Error(`No E2E page image fixture matches scene: ${scene}`)
}
