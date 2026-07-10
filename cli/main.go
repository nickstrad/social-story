// Command social-story turns a plain-text social story into a set of
// illustrated pages using OpenAI.
//
// Three commands:
//   1. parse    -> read a social story text file, ask a chat model to split it
//                  into pages and write a structured story.json.
//   2. generate -> for each page in story.json, decide whether one personal
//                  photo from photos/ fits the page (attaching at most one), then
//                  call the image model and write one PNG per page.
//   3. redo     -> regenerate one or more pages referenced from the JSON file as
//                  new variants (page2_1, page2_2 ...), with the same photo step.
//                  Multiple pages run concurrently.
//
// Personalization is optional: with no photos/ folder (or no index file) the
// tool generates plain illustrations. See photos/index.md for the index format.
//
// The whole thing needs exactly one environment variable: OPENAI_API_KEY.
//
// Usage:
//
//	social-story parse    story.txt [story.json]         # just build the JSON
//	social-story title    story.json  [outDir]           # book-cover page -> title.png
//	social-story generate story.json  [outDir]           # images from a JSON file
//	social-story redo     story.json  <pages> [outDir]   # regenerate page(s): 3 or 2,4,14 or 2-5
//	social-story pdf      story.json  [outDir]           # combine into one PDF (cover first)
package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ---- audience context ------------------------------------------------------
//
// Every image prompt is wrapped with this so the whole book stays visually
// consistent and on-target for the reader.

// styleContext sets the art style and reader-appropriate tone. It is added to
// EVERY image (people or not) and deliberately says that many pages are scene
// only, so the family is not forced into pages that don't call for them.
const styleContext = `Warm, friendly children's book illustration for a social story, drawn respectfully and authentically.
The book is for a 7-year-old high-functioning autistic child, so keep every scene calm and clear: soft colors, gentle lighting, uncluttered backgrounds, simple and unambiguous shapes, no scary or overwhelming imagery, and a single obvious focal point.
Consistent art style across all pages.
Many pages show only a place, object, or activity with NO people in them — that is expected and good. Only include people when this page's scene specifically calls for them, and never add extra characters that were not asked for.`

// familyCast describes the recurring characters. It is added ONLY to pages that
// actually feature family members.
const familyCast = `
The family is Black / African American, with natural hairstyles and rich brown skin tones. Keep these ages and genders exactly right and consistent every time:
- Nick: the dad, a 35-year-old man, short hair and a short beard.
- Arielle: the mom, a 35-year-old woman, long dark hair.
- Allison: the daughter, a 7-year-old GIRL, dark hair often in two puff buns. She is the child this book is for.
- Ezra: the son, a 4-year-old BOY (Allison's little brother), short hair. Draw him clearly as a young boy, not a girl.
Only include the specific family members this page calls for; do not add extra children.`

// baseSheetInstruction is added to a page prompt when the character-sheet base
// image is attached as the consistency anchor.
const baseSheetInstruction = "\n\nA character reference sheet is attached as the FIRST image. It shows the established look of the family. Match each family member's face, hair, skin tone, body proportions, age, and gender to that sheet so the characters stay consistent with the rest of the book. You MAY change their clothing, pose, and the setting to fit this page's scene — only their identity and art style must match the sheet."

// buildImagePrompt wraps a page's scene description with the shared style
// context. The family cast + anchor/photo notes are included only when the page
// actually features people (hasPeople), so scene-only pages stay people-free.
func buildImagePrompt(scene string, characters []string, anchored bool, photoNote string) string {
	p := styleContext + "\n\nScene for this page: " + strings.TrimSpace(scene)
	if len(characters) == 0 {
		p += "\n\nThis page has NO people in it. Illustrate only the place, objects, or activity described — do not add any characters or figures."
		return p
	}
	p += "\n" + familyCast
	// The characters array is authoritative for who appears: state it explicitly
	// so the illustration includes exactly these family members (and, per the
	// sibling rule, both children whenever either is listed), even if the scene
	// text above happens to name only some of them.
	p += "\n\nThe following family members appear together in this scene: " +
		strings.Join(characters, ", ") + ". Include every one of them and no other people."
	if anchored {
		p += baseSheetInstruction
	}
	if photoNote != "" {
		which := "A reference photo is attached"
		if anchored {
			which = "An additional reference photo is also attached"
		}
		p += "\n\n" + which + " showing the real " + strings.TrimSpace(photoNote) +
			". Use it for their likeness (same faces, hair, and skin tone), redrawn in the storybook art style. Do not copy the photo's background; use it only for the character likeness."
	}
	return p
}

// baseSheetPrompt is the prompt used to generate the reusable character sheet.
func baseSheetPrompt() string {
	return styleContext + "\n" + familyCast +
		"\n\nProduce a CHARACTER REFERENCE SHEET (not a story scene): all four family members standing in a row, full body, facing forward, evenly lit on a plain neutral background with no props, furniture, or scenery. Simple everyday clothing. Clear, friendly faces. The goal is a clean model sheet that defines each character's look so they can be drawn consistently across the whole book. Attached photos show the real people — match their likeness."
}

// titlePrompt is the prompt used to generate the book-cover illustration. The
// title words are NOT drawn by the image model (unreliable spelling); they are
// rendered deterministically afterward as a caption band, so the illustration
// deliberately leaves calm open space for them.
func titlePrompt(title, note string) string {
	p := styleContext + "\n" + familyCast +
		"\n\nProduce a BOOK COVER illustration for a children's social story titled \"" + strings.TrimSpace(title) +
		"\". Show the whole family together in a warm, welcoming cover scene that gently hints at the story's setting, everyone facing forward and smiling as a friendly group portrait. Keep the composition calm and uncluttered with plenty of open space near the top and bottom. Do NOT draw any text, letters, words, or a title in the image — the title will be added separately."
	if n := strings.TrimSpace(note); n != "" {
		p += "\n\nAlso incorporate these details into the cover scene: " + n +
			". Keep them tasteful and clear, and still do not draw any text or words."
	}
	return p
}

// ---- data model ------------------------------------------------------------

type Story struct {
	Title string `json:"title"`
	Pages []Page `json:"pages"`
}

type Page struct {
	Page        int      `json:"page"`         // 1-based page number
	Text        string   `json:"text"`         // the words on the page
	ImagePrompt string   `json:"image_prompt"` // scene description for the illustrator
	Characters  []string `json:"characters"`   // family members shown on this page; empty = scene-only
}

// hasPeople reports whether this page's illustration features family members.
func (p Page) hasPeople() bool { return len(p.Characters) > 0 }

// The two children are always drawn together: if a page includes one sibling,
// it must include the other. This keeps Allison and Ezra as a pair in every
// scene that features either of them.
var siblings = []string{"Allison", "Ezra"}

// pairSiblings enforces the sibling rule on every page: whenever a page's
// characters include Allison or Ezra, both are present. Any missing sibling is
// appended (Allison before Ezra) while other characters keep their order. It is
// idempotent, so it is safe to run on freshly parsed stories and on stories
// loaded from disk. It reports how many pages were changed.
func pairSiblings(story *Story) int {
	changed := 0
	for i := range story.Pages {
		chars := story.Pages[i].Characters
		has := map[string]bool{}
		for _, name := range chars {
			has[name] = true
		}
		if !has["Allison"] && !has["Ezra"] {
			continue // no sibling on this page; leave it untouched
		}
		added := false
		for _, sib := range siblings {
			if !has[sib] {
				chars = append(chars, sib)
				added = true
			}
		}
		if added {
			story.Pages[i].Characters = chars
			changed++
		}
	}
	return changed
}

// ---- personal photo library ------------------------------------------------

// photoLibrary is the contents of the photos/ folder: the free-text index that
// describes each image, plus the list of actual image files present.
type photoLibrary struct {
	Index  string   // raw markdown/text describing the photos
	Photos []string // image file names present in photosDir
}

// loadPhotoLibrary reads photos/ and its index file. Everything is optional: a
// missing folder or index just yields an empty library (no photos attached).
func loadPhotoLibrary() photoLibrary {
	entries, err := os.ReadDir(photosDir)
	if err != nil {
		return photoLibrary{}
	}
	var lib photoLibrary
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if photoExts[strings.ToLower(filepath.Ext(e.Name()))] {
			lib.Photos = append(lib.Photos, e.Name())
		}
	}
	for _, name := range indexNames {
		if data, err := os.ReadFile(filepath.Join(photosDir, name)); err == nil {
			lib.Index = string(data)
			break
		}
	}
	if lib.Index == "" && len(lib.Photos) > 0 {
		fmt.Printf("  (no index file in %s/; found %d photos but skipping personalization)\n", photosDir, len(lib.Photos))
		lib.Photos = nil
	}
	return lib
}

// photoChoice is the model's decision about which single photo (if any) to
// attach to a page's illustration.
type photoChoice struct {
	File    string `json:"file"`    // chosen file name, or "" for none
	Subject string `json:"subject"` // short description of who/what is in it (e.g. "my daughter")
}

// ---- OpenAI models ---------------------------------------------------------

const (
	// Defaults. gpt-image-2 gives the best quality/likeness; for cheap test runs
	// override with --image-model gpt-image-1-mini.
	defaultChatModel  = "gpt-5.5"
	defaultImageModel = "gpt-image-2"

	// defaultConcurrency images produced at once; work is network-bound, so this
	// is bounded by API rate limits, not the machine. defaultRetries covers
	// transient 429/5xx bursts that higher concurrency can provoke.
	defaultConcurrency = 10
	defaultRetries     = 3
	imageSize         = "1024x1024"

	// photosDir holds personal reference photos plus an index file describing
	// each one. If the folder or index is missing, generation still works with
	// no reference photos attached.
	photosDir = "photos"

	// defaultBasePath is the character-sheet anchor image. When it exists it is
	// attached to every page for cross-page consistency; override with --base.
	defaultBasePath = "character_base.png"
)

// indexNames are the file names looked for (in order) inside photosDir.
var indexNames = []string{"index.md", "index.markdown", "index.txt"}

// photoExts are recognized image extensions in the photos folder.
var photoExts = map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".webp": true}

// imageMIME maps a photo file extension to the MIME type the API expects.
func imageMIME(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	default:
		return "image/jpeg"
	}
}

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}

	loadDotEnv(".env")
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		fatal("OPENAI_API_KEY is not set (put it in a root-level .env file)")
	}
	client := &openAIClient{
		apiKey:     apiKey,
		http:       &http.Client{Timeout: 10 * time.Minute},
		chatModel:  defaultChatModel,
		imageModel: defaultImageModel,
		maxRetries: defaultRetries,
	}

	// Options work on every command (e.g. --chat-model gpt-4o-mini,
	// --image-model gpt-image-2). They are stripped from the args here so the
	// positional arguments below are unaffected.
	rawArgs, chatModel := extractStrFlag(os.Args[2:], "--chat-model")
	rawArgs, imageModel := extractStrFlag(rawArgs, "--image-model")
	rawArgs, basePath := extractStrFlag(rawArgs, "--base")
	rawArgs, caption := extractBoolFlag(rawArgs, "--caption")
	rawArgs, concurrency, hasConcurrency := extractIntFlag(rawArgs, "--concurrency")
	rawArgs, retries, hasRetries := extractIntFlag(rawArgs, "--retries")
	if chatModel != "" {
		client.chatModel = chatModel
	}
	if imageModel != "" {
		client.imageModel = imageModel
	}
	if basePath == "" {
		basePath = defaultBasePath
	}
	if !hasConcurrency || concurrency < 1 {
		concurrency = defaultConcurrency
	}
	if hasRetries && retries >= 0 {
		client.maxRetries = retries
	}
	fmt.Printf("Models: chat=%s image=%s\n", client.chatModel, client.imageModel)

	switch os.Args[1] {
	case "parse":
		args := rawArgs
		if len(args) < 1 {
			fatal("usage: social-story parse story.txt [story.json]")
		}
		storyPath := args[0]
		jsonPath := optArg(args, 1, deriveJSONPath(storyPath))
		mustParse(client, storyPath, jsonPath)

	case "base":
		// Generate the reusable character-sheet anchor from photos/.
		mustBase(client, basePath)

	case "title":
		// Generate the book-cover (title) page image into outDir/title.png.
		args := rawArgs
		args, note := extractStrFlag(args, "--note")
		if len(args) < 1 {
			fatal("usage: social-story title story.json [outDir] [--note \"extra cover details\"]")
		}
		story := loadStory(args[0])
		outDir := optArg(args, 1, "images")
		mustTitle(client, story, outDir, basePath, note)

	case "generate":
		args := rawArgs
		args, page, hasPage := extractIntFlag(args, "--page")
		args, limit, hasLimit := extractIntFlag(args, "--limit")
		if len(args) < 1 {
			fatal("usage: social-story generate story.json [outDir] [--page N] [--limit N] [--caption]")
		}
		story := loadStory(args[0])
		outDir := optArg(args, 1, "images")
		if hasPage {
			// Test one page before committing to a full run.
			story.Pages = filterToPage(story.Pages, page)
		} else if hasLimit {
			// Test the first N pages.
			if limit < len(story.Pages) {
				story.Pages = story.Pages[:limit]
			}
		}
		mustGenerate(client, story, outDir, basePath, caption, concurrency)

	case "redo":
		args := rawArgs
		if len(args) < 2 {
			fatal("usage: social-story redo story.json <page#>[,page#,...] [outDir] [--caption]")
		}
		story := loadStory(args[0])
		pageNums, err := parsePageList(args[1])
		if err != nil {
			fatal("%v", err)
		}
		outDir := optArg(args, 2, "images")
		mustRedo(client, story, pageNums, outDir, basePath, caption, concurrency)

	case "caption":
		// Deterministically add the text band to already-generated page images.
		args := rawArgs
		args, pageSel := extractStrFlag(args, "--page")
		if len(args) < 1 {
			fatal("usage: social-story caption story.json [outDir] [--page 2,4,10]")
		}
		story := loadStory(args[0])
		outDir := optArg(args, 1, "images")
		var only map[int]bool
		if pageSel != "" {
			nums, err := parsePageList(pageSel)
			if err != nil {
				fatal("%v", err)
			}
			only = make(map[int]bool, len(nums))
			for _, n := range nums {
				only[n] = true
			}
		}
		mustCaption(story, outDir, only)

	case "pdf":
		// Assemble the whole story into one PDF (final_stories/) from the
		// already-generated page images. Deterministic, no AI model.
		args := rawArgs
		if len(args) < 1 {
			fatal("usage: social-story pdf story.json [outDir]")
		}
		story := loadStory(args[0])
		outDir := optArg(args, 1, "images")
		mustPDF(story, outDir, args[0])

	default:
		usage()
		os.Exit(2)
	}
}

// ---- steps -----------------------------------------------------------------

func mustParse(c *openAIClient, storyPath, jsonPath string) Story {
	raw, err := os.ReadFile(storyPath)
	if err != nil {
		fatal("reading story: %v", err)
	}
	fmt.Printf("Parsing %q into pages...\n", storyPath)
	story, err := c.parseStory(context.Background(), string(raw))
	if err != nil {
		fatal("parsing story: %v", err)
	}
	if n := pairSiblings(&story); n > 0 {
		fmt.Printf("Paired siblings: added a missing sibling on %d page(s).\n", n)
	}
	data, err := json.MarshalIndent(story, "", "  ")
	if err != nil {
		fatal("marshaling json: %v", err)
	}
	if err := os.WriteFile(jsonPath, data, 0o644); err != nil {
		fatal("writing json: %v", err)
	}
	fmt.Printf("Wrote %d pages -> %s\n", len(story.Pages), jsonPath)
	return story
}

// mustBase generates the character-sheet anchor image from photos/ and writes
// it to basePath. All available photos are attached as references so the sheet
// matches the real family.
func mustBase(c *openAIClient, basePath string) {
	lib := loadPhotoLibrary()
	var refs []string
	for _, name := range lib.Photos {
		refs = append(refs, filepath.Join(photosDir, name))
	}
	if len(refs) > 0 {
		fmt.Printf("Building character sheet from %d photo(s) -> %s\n", len(refs), basePath)
	} else {
		fmt.Printf("Building character sheet (no photos found) -> %s\n", basePath)
	}
	if err := c.generateImageToFile(context.Background(), baseSheetPrompt(), refs, basePath); err != nil {
		fatal("building character sheet: %v", err)
	}
	fmt.Printf("Done -> %s\n(Now run 'generate'; it will use this as the consistency anchor.)\n", basePath)
}

// titleImageName is the fixed file name of the book-cover image within an output
// folder. The PDF step always places it first when present.
const titleImageName = "title.png"

// mustTitle generates the book-cover image into outDir/title.png: a family cover
// illustration (anchored to the character sheet for consistency) with the story
// title rendered on top as a deterministic caption band. The PDF step then puts
// this page first.
func mustTitle(c *openAIClient, story Story, outDir, basePath, note string) {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		fatal("creating output dir: %v", err)
	}
	anchor := anchorPath(basePath)
	var refs []string
	prompt := titlePrompt(story.Title, note)
	if anchor != "" {
		refs = append(refs, anchor)
		prompt += baseSheetInstruction
	}
	out := filepath.Join(outDir, titleImageName)
	fmt.Printf("Generating title page for %q -> %s\n", story.Title, out)
	if err := c.generateImageToFile(context.Background(), prompt, refs, out); err != nil {
		fatal("building title page: %v", err)
	}
	// Always print the title text (a cover without its title is pointless), even
	// though page captions are opt-in.
	if strings.TrimSpace(story.Title) != "" {
		if err := addCaption(out, out, story.Title); err != nil {
			fatal("adding title text: %v", err)
		}
	}
	fmt.Printf("Done -> %s\n", out)
}

// mustGenerate produces every page image, up to concurrency at once. Because the
// work is network-bound, wall-clock is roughly the time of the slowest page
// (image + caption) rather than the serial sum of every page.
func mustGenerate(c *openAIClient, story Story, outDir, basePath string, caption bool, concurrency int) {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		fatal("creating output dir: %v", err)
	}
	lib := loadPhotoLibrary()
	anchor := anchorPath(basePath)

	if len(story.Pages) > 1 {
		fmt.Printf("Generating %d pages, up to %d at a time (heartbeat every %s)...\n",
			len(story.Pages), concurrency, heartbeatInterval)
	}

	pr := newProgress()
	pr.startHeartbeat()

	sem := make(chan struct{}, concurrency) // limits pages in flight to concurrency
	var wg sync.WaitGroup
	var mu sync.Mutex // serializes firstErr
	var firstErr error
	var worker atomic.Int64 // monotonically assigned worker id per page

	for _, p := range story.Pages {
		wg.Add(1)
		go func(p Page) {
			defer wg.Done()
			w := int(worker.Add(1))
			pr.logf("worker %d: page %d queued, waiting for a free slot (%d max in flight)", w, p.Page, concurrency)
			sem <- struct{}{}        // acquire a slot (blocks past maxConcurrent)
			defer func() { <-sem }() // release it

			out := filepath.Join(outDir, fmt.Sprintf("page%d.png", p.Page))
			pr.begin(p.Page, w, "starting")
			err := renderOne(c, p, out, lib, anchor, caption, pr)
			pr.finish(p.Page, err)

			if err != nil {
				mu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				mu.Unlock()
			}
		}(p)
	}
	wg.Wait()
	pr.stopHeartbeat()

	if firstErr != nil {
		fatal("%v", firstErr)
	}
	fmt.Printf("Done. %d images in %s\n", len(story.Pages), outDir)
}

// mustCaption adds the deterministic text band to already-generated page images.
// When only is non-nil, only those page numbers are captioned (useful for pages
// regenerated without --caption); nil captions every page. Captioning is NOT
// idempotent — it appends a band each call — so restrict it to pages that don't
// already have one.
func mustCaption(story Story, outDir string, only map[int]bool) {
	n := 0
	for _, p := range story.Pages {
		if only != nil && !only[p.Page] {
			continue
		}
		out := filepath.Join(outDir, fmt.Sprintf("page%d.png", p.Page))
		if _, err := os.Stat(out); err != nil {
			fmt.Printf("  (skipping page %d: %s not found)\n", p.Page, out)
			continue
		}
		captionInPlace(out, p.Text)
		n++
	}
	fmt.Printf("Captioned %d image(s) in %s\n", n, outDir)
}

// captionInPlace renders the text band onto the image at path, overwriting it.
func captionInPlace(path, text string) {
	if err := addCaption(path, path, text); err != nil {
		fatal("captioning %s: %v", path, err)
	}
	fmt.Printf("  captioned %s\n", path)
}

// anchorPath returns basePath if the character sheet exists, else "" with a
// one-time notice so plain generation still works.
func anchorPath(basePath string) string {
	if _, err := os.Stat(basePath); err == nil {
		fmt.Printf("Using character sheet %s as consistency anchor.\n", basePath)
		return basePath
	}
	fmt.Printf("(No character sheet at %s; run 'base' first for cross-page consistency.)\n", basePath)
	return ""
}

// renderOne produces one page's final image (illustration + optional caption)
// as a single unit of work. It is safe to run concurrently: all output goes
// through pr, which serializes logging and tracks the page's live phase so the
// heartbeat can report on it. On pages that feature people it attaches the
// character-sheet anchor (when present) plus at most one fitting personal photo;
// scene-only pages get neither.
func renderOne(c *openAIClient, p Page, out string, lib photoLibrary, anchor string, caption bool, pr *progress) error {
	ctx := context.Background()
	var refs []string
	photoNote := ""
	anchored := false

	if p.hasPeople() {
		if anchor != "" {
			refs = append(refs, anchor) // anchor is always the FIRST reference
			anchored = true
		}
		if len(lib.Photos) > 0 {
			pr.phase(p.Page, "picking a reference photo")
			choice, err := c.pickPhoto(ctx, p, lib)
			if err != nil {
				pr.logf("  page %d: photo pick failed: %v; no photo attached", p.Page, err)
			} else if choice.File != "" {
				refs = append(refs, filepath.Join(photosDir, choice.File))
				photoNote = choice.Subject
				pr.logf("  page %d: attaching %s (%s)", p.Page, choice.File, choice.Subject)
			}
		}
		pr.phase(p.Page, fmt.Sprintf("generating image [%s] -> %s", strings.Join(p.Characters, ", "), out))
	} else {
		pr.phase(p.Page, fmt.Sprintf("generating image [scene only] -> %s", out))
	}

	prompt := buildImagePrompt(p.ImagePrompt, p.Characters, anchored, photoNote)
	if err := c.generateImageToFile(ctx, prompt, refs, out); err != nil {
		return fmt.Errorf("page %d: %w", p.Page, err)
	}
	if caption {
		pr.phase(p.Page, "captioning")
		if err := addCaption(out, out, p.Text); err != nil {
			return fmt.Errorf("captioning page %d: %w", p.Page, err)
		}
	}
	return nil
}

// mustRedo regenerates one or more pages as new variants (page{N}_1, page{N}_2,
// ...) without clobbering earlier images. Multiple pages run concurrently (up to
// concurrency at a time), just like a full generate, so redoing several pages
// takes about as long as the slowest single page rather than the serial sum.
func mustRedo(c *openAIClient, story Story, pageNums []int, outDir, basePath string, caption bool, concurrency int) {
	// Resolve each requested page number to its Page, failing early on any typo.
	pages := make([]Page, 0, len(pageNums))
	for _, pageNum := range pageNums {
		var page *Page
		for i := range story.Pages {
			if story.Pages[i].Page == pageNum {
				page = &story.Pages[i]
				break
			}
		}
		if page == nil {
			fatal("page %d not found in story", pageNum)
		}
		pages = append(pages, *page)
	}
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		fatal("creating output dir: %v", err)
	}

	// Reserve each page's next variant path up front (single-threaded) so
	// concurrent workers never race on nextVariant for distinct pages.
	outFor := make(map[int]string, len(pages))
	for _, p := range pages {
		next := nextVariant(outDir, p.Page)
		outFor[p.Page] = filepath.Join(outDir, fmt.Sprintf("page%d_%d.png", p.Page, next))
	}

	if len(pages) > 1 {
		fmt.Printf("Redoing %d pages, up to %d at a time (heartbeat every %s)...\n",
			len(pages), concurrency, heartbeatInterval)
	}

	lib := loadPhotoLibrary()
	anchor := anchorPath(basePath)

	pr := newProgress()
	pr.startHeartbeat()

	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex
	var firstErr error
	var worker atomic.Int64

	for _, p := range pages {
		wg.Add(1)
		go func(p Page) {
			defer wg.Done()
			w := int(worker.Add(1))
			pr.logf("worker %d: page %d queued, waiting for a free slot (%d max in flight)", w, p.Page, concurrency)
			sem <- struct{}{}
			defer func() { <-sem }()

			out := outFor[p.Page]
			pr.begin(p.Page, w, "starting")
			err := renderOne(c, p, out, lib, anchor, caption, pr)
			pr.finish(p.Page, err)
			if err != nil {
				mu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				mu.Unlock()
				return
			}
			pr.logf("page %d done -> %s", p.Page, out)
		}(p)
	}
	wg.Wait()
	pr.stopHeartbeat()

	if firstErr != nil {
		fatal("%v", firstErr)
	}
	for _, p := range pages {
		fmt.Printf("Done -> %s\n", outFor[p.Page])
	}
}

// parsePageList parses a redo page selector like "3", "2,4,14" or "2-5,9" into a
// deduplicated, order-preserving list of page numbers. Ranges are inclusive.
func parsePageList(s string) ([]int, error) {
	var out []int
	seen := map[int]bool{}
	add := func(n int) {
		if !seen[n] {
			seen[n] = true
			out = append(out, n)
		}
	}
	for part := range strings.SplitSeq(s, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if lo, hi, ok := strings.Cut(part, "-"); ok {
			a, err1 := strconv.Atoi(strings.TrimSpace(lo))
			b, err2 := strconv.Atoi(strings.TrimSpace(hi))
			if err1 != nil || err2 != nil || a > b {
				return nil, fmt.Errorf("invalid page range %q", part)
			}
			for n := a; n <= b; n++ {
				add(n)
			}
			continue
		}
		n, err := strconv.Atoi(part)
		if err != nil {
			return nil, fmt.Errorf("invalid page number %q", part)
		}
		add(n)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no page numbers given")
	}
	return out, nil
}

// nextVariant returns the next integer suffix for a page's redo, so repeated
// redos produce page{N}_1, page{N}_2, ... without clobbering earlier variants.
func nextVariant(outDir string, pageNum int) int {
	re := regexp.MustCompile(fmt.Sprintf(`^page%d_(\d+)\.png$`, pageNum))
	max := 0
	entries, _ := os.ReadDir(outDir)
	for _, e := range entries {
		if m := re.FindStringSubmatch(e.Name()); m != nil {
			if n, err := strconv.Atoi(m[1]); err == nil && n > max {
				max = n
			}
		}
	}
	return max + 1
}

// ---- OpenAI client ---------------------------------------------------------

type openAIClient struct {
	apiKey     string
	http       *http.Client
	chatModel  string // model for parsing + photo selection
	imageModel string // model for image generation
	maxRetries int    // retries on transient (429/5xx/network) failures
}

// parseStory asks the chat model to split the free-text story into structured
// pages, each with the words to show and an illustration description.
func (c *openAIClient) parseStory(ctx context.Context, text string) (Story, error) {
	system := `You convert a social story into a structured, illustrated picture book.
Split the story into pages a 7-year-old can follow (usually 1-3 sentences each). Aim for ABOUT 20 pages total (roughly 18-22); do not exceed ~24. Group closely related sentences onto the same page rather than splitting every sentence.

For every page provide:
  - "page": the 1-based page number,
  - "text": the exact words to print on that page (kept simple and reassuring),
  - "image_prompt": a concrete visual description of the single scene on that page. Describe only the scene contents, not the art style.
  - "characters": an array of which family members appear in the illustration. The family is Nick (dad), Arielle (mom), Allison (the 7-year-old girl this book is for), and Ezra (her 4-year-old brother). Use "Allison" for the first-person narrator "I". Use an EMPTY array for scene-only pages.

IMPORTANT about illustrations: do NOT put people in every page. Many pages are better illustrated as just the place, object, or activity being described (e.g. an airport terminal, an airplane seat, a swimming pool, sand and shells on a beach, a plate of food, a suitcase, a journal). Only include family members ("characters" non-empty) when the page is specifically about a person doing something. Aim for a good mix: a large share of pages should be scene-only with an empty "characters" array. When people do appear, keep the group small (often just the two kids, or the kids with one grown-up) rather than the whole family every time.

SIBLINGS RULE: Allison and Ezra are always drawn together. Whenever a page includes one of them, include BOTH in "characters" (never Allison without Ezra, and never Ezra without Allison). So a page focused on Allison should list ["Allison", "Ezra"], and Allison with a grown-up should list ["Allison", "Ezra", <grown-up>].

Respond ONLY with JSON matching the requested schema.`

	schema := map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"title", "pages"},
		"properties": map[string]any{
			"title": map[string]any{"type": "string"},
			"pages": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"page", "text", "image_prompt", "characters"},
					"properties": map[string]any{
						"page":         map[string]any{"type": "integer"},
						"text":         map[string]any{"type": "string"},
						"image_prompt": map[string]any{"type": "string"},
						"characters": map[string]any{
							"type":  "array",
							"items": map[string]any{"type": "string"},
						},
					},
				},
			},
		},
	}

	reqBody := map[string]any{
		"model": c.chatModel,
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": text},
		},
		"response_format": map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   "social_story",
				"strict": true,
				"schema": schema,
			},
		},
	}

	var resp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := c.postJSON(ctx, "https://api.openai.com/v1/chat/completions", reqBody, &resp); err != nil {
		return Story{}, err
	}
	if len(resp.Choices) == 0 {
		return Story{}, fmt.Errorf("no choices returned")
	}

	var story Story
	if err := json.Unmarshal([]byte(resp.Choices[0].Message.Content), &story); err != nil {
		return Story{}, fmt.Errorf("decoding model output: %w", err)
	}
	if len(story.Pages) == 0 {
		return Story{}, fmt.Errorf("model returned no pages")
	}
	return story, nil
}

// pickPhoto asks the chat model to choose at most one photo from the library
// that would personalize this page's illustration. It returns an empty File
// when no photo is a good fit.
func (c *openAIClient) pickPhoto(ctx context.Context, page Page, lib photoLibrary) (photoChoice, error) {
	system := `You choose reference photos for a personalized social-story picture book.
Given one page (its text and scene) and an index describing available personal photos, pick AT MOST ONE photo whose subject genuinely appears in or fits this page's scene, to make the illustration feel personal.
Rules:
  - Choose a photo ONLY when its subject (a specific person, pet, or place) clearly belongs in this page's scene.
  - If no photo is a natural fit, return an empty "file". Do not force a match.
  - "file" must be exactly one of the provided file names, or "".
  - "subject" is a short natural description of who/what the photo shows (e.g. "my daughter"), taken from the index; empty when no photo is chosen.
Respond ONLY with JSON matching the schema.`

	user := fmt.Sprintf("Available photos (file names): %s\n\nPhoto index:\n%s\n\nPage %d text: %s\n\nPage %d scene: %s",
		strings.Join(lib.Photos, ", "), lib.Index, page.Page, page.Text, page.Page, page.ImagePrompt)

	schema := map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"file", "subject"},
		"properties": map[string]any{
			"file":    map[string]any{"type": "string"},
			"subject": map[string]any{"type": "string"},
		},
	}
	reqBody := map[string]any{
		"model": c.chatModel,
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": user},
		},
		"response_format": map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   "photo_choice",
				"strict": true,
				"schema": schema,
			},
		},
	}
	var resp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := c.postJSON(ctx, "https://api.openai.com/v1/chat/completions", reqBody, &resp); err != nil {
		return photoChoice{}, err
	}
	if len(resp.Choices) == 0 {
		return photoChoice{}, fmt.Errorf("no choices returned")
	}
	var choice photoChoice
	if err := json.Unmarshal([]byte(resp.Choices[0].Message.Content), &choice); err != nil {
		return photoChoice{}, fmt.Errorf("decoding photo choice: %w", err)
	}
	// Guard against a hallucinated file name.
	if choice.File != "" && !slices.Contains(lib.Photos, choice.File) {
		return photoChoice{}, nil
	}
	return choice, nil
}

// generateImageToFile renders one image and writes it as PNG. When refPaths is
// non-empty, those photos are attached as references via the image edits
// endpoint; otherwise a fresh image is generated from the prompt alone.
func (c *openAIClient) generateImageToFile(ctx context.Context, prompt string, refPaths []string, path string) error {
	var b64 string
	var err error
	if len(refPaths) > 0 {
		b64, err = c.imageEdit(ctx, prompt, refPaths)
	} else {
		b64, err = c.imageGenerate(ctx, prompt)
	}
	if err != nil {
		return err
	}
	img, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return fmt.Errorf("decoding image: %w", err)
	}
	return os.WriteFile(path, img, 0o644)
}

// imageGenerate creates an image from the prompt alone (no reference photo).
func (c *openAIClient) imageGenerate(ctx context.Context, prompt string) (string, error) {
	reqBody := map[string]any{
		"model":  c.imageModel,
		"prompt": prompt,
		"size":   imageSize,
		"n":      1,
	}
	var resp imageResponse
	if err := c.postJSON(ctx, "https://api.openai.com/v1/images/generations", reqBody, &resp); err != nil {
		return "", err
	}
	return resp.first()
}

// addImagePart writes one image file as a multipart form part with the correct
// MIME type (CreateFormFile would mislabel it application/octet-stream).
func addImagePart(w *multipart.Writer, field, refPath string) error {
	f, err := os.Open(refPath)
	if err != nil {
		return fmt.Errorf("opening reference photo: %w", err)
	}
	defer f.Close()
	hdr := textproto.MIMEHeader{}
	hdr.Set("Content-Disposition", fmt.Sprintf(`form-data; name=%q; filename=%q`, field, filepath.Base(refPath)))
	hdr.Set("Content-Type", imageMIME(refPath))
	fw, err := w.CreatePart(hdr)
	if err != nil {
		return err
	}
	_, err = io.Copy(fw, f)
	return err
}

// imageEdit creates an image using one or more reference photos (multipart).
// Multiple images are sent as repeated "image[]" parts, in the given order.
func (c *openAIClient) imageEdit(ctx context.Context, prompt string, refPaths []string) (string, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	_ = w.WriteField("model", c.imageModel)
	_ = w.WriteField("prompt", prompt)
	_ = w.WriteField("size", imageSize)
	_ = w.WriteField("n", "1")

	field := "image"
	if len(refPaths) > 1 {
		field = "image[]"
	}
	for _, refPath := range refPaths {
		if err := addImagePart(w, field, refPath); err != nil {
			return "", err
		}
	}
	if err := w.Close(); err != nil {
		return "", err
	}

	contentType := w.FormDataContentType()
	body := buf.Bytes()
	data, err := c.doWithRetry(ctx, func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.openai.com/v1/images/edits", bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", contentType)
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		return req, nil
	})
	if err != nil {
		return "", err
	}
	var resp imageResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return "", err
	}
	return resp.first()
}

type imageResponse struct {
	Data []struct {
		B64JSON string `json:"b64_json"`
	} `json:"data"`
}

func (r imageResponse) first() (string, error) {
	if len(r.Data) == 0 || r.Data[0].B64JSON == "" {
		return "", fmt.Errorf("no image data returned")
	}
	return r.Data[0].B64JSON, nil
}

// postJSON sends body as JSON to url and decodes the response into out.
func (c *openAIClient) postJSON(ctx context.Context, url string, body, out any) error {
	buf, err := json.Marshal(body)
	if err != nil {
		return err
	}
	data, err := c.doWithRetry(ctx, func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(buf))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		return req, nil
	})
	if err != nil {
		return err
	}
	return json.Unmarshal(data, out)
}

// doWithRetry sends the request built by build and returns the response body on
// success. It retries up to c.maxRetries times on transient failures (429 and
// 5xx, plus network errors), using exponential backoff and honoring a
// Retry-After header when present. Non-transient error statuses fail fast.
func (c *openAIClient) doWithRetry(ctx context.Context, build func() (*http.Request, error)) ([]byte, error) {
	var lastErr error
	var retryAfter time.Duration

	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if attempt > 0 {
			wait := retryAfter
			if wait <= 0 {
				wait = time.Second << (attempt - 1) // 1s, 2s, 4s, ...
			}
			fmt.Printf("  (retry %d/%d after %s: %v)\n", attempt, c.maxRetries, wait, lastErr)
			select {
			case <-time.After(wait):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
			retryAfter = 0
		}

		req, err := build()
		if err != nil {
			return nil, err // request construction errors are not retryable
		}
		res, err := c.http.Do(req)
		if err != nil {
			lastErr = err // network error: retry
			continue
		}
		data, err := io.ReadAll(res.Body)
		res.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}
		if res.StatusCode >= 200 && res.StatusCode < 300 {
			return data, nil
		}

		msg := strings.TrimSpace(string(data))
		if res.StatusCode == 429 || res.StatusCode >= 500 {
			lastErr = fmt.Errorf("openai %s: %s", res.Status, msg)
			retryAfter = parseRetryAfter(res.Header.Get("Retry-After"))
			continue
		}
		// Client error (400, 401, 403, 404, ...): not worth retrying.
		return nil, fmt.Errorf("openai %s: %s", res.Status, msg)
	}
	return nil, fmt.Errorf("gave up after %d retries: %w", c.maxRetries, lastErr)
}

// parseRetryAfter reads a Retry-After header value expressed in seconds.
func parseRetryAfter(v string) time.Duration {
	if v == "" {
		return 0
	}
	if secs, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && secs > 0 {
		return time.Duration(secs) * time.Second
	}
	return 0
}

// ---- helpers ---------------------------------------------------------------

// loadDotEnv reads a simple KEY=VALUE file (if present) and sets any variables
// that are not already defined in the process environment. Lines starting with
// '#' and blank lines are ignored; surrounding quotes on values are stripped.
// A missing file is not an error.
func loadDotEnv(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for line := range strings.Lines(string(data)) {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		val = strings.Trim(val, `"'`)
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, val)
		}
	}
}

func loadStory(path string) Story {
	data, err := os.ReadFile(path)
	if err != nil {
		fatal("reading %s: %v", path, err)
	}
	var s Story
	if err := json.Unmarshal(data, &s); err != nil {
		fatal("parsing %s: %v", path, err)
	}
	// Enforce the sibling rule on stories loaded from disk too, so hand-edited
	// or older JSON still keeps Allison and Ezra paired at image time.
	pairSiblings(&s)
	return s
}

func deriveJSONPath(storyPath string) string {
	base := strings.TrimSuffix(filepath.Base(storyPath), filepath.Ext(storyPath))
	return base + ".json"
}

// extractIntFlag pulls "--name N" (or "--name=N") out of args, returning the
// remaining positional args, the parsed value, and whether it was present.
func extractIntFlag(args []string, name string) ([]string, int, bool) {
	rest := make([]string, 0, len(args))
	val, found := 0, false
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == name:
			if i+1 >= len(args) {
				fatal("%s needs a number", name)
			}
			n, err := strconv.Atoi(args[i+1])
			if err != nil {
				fatal("%s must be an integer: %v", name, err)
			}
			val, found = n, true
			i++ // skip the value
		case strings.HasPrefix(a, name+"="):
			n, err := strconv.Atoi(strings.TrimPrefix(a, name+"="))
			if err != nil {
				fatal("%s must be an integer: %v", name, err)
			}
			val, found = n, true
		default:
			rest = append(rest, a)
		}
	}
	return rest, val, found
}

// extractStrFlag pulls "--name VALUE" (or "--name=VALUE") out of args, returning
// the remaining positional args and the value ("" if the flag was absent).
func extractStrFlag(args []string, name string) ([]string, string) {
	rest := make([]string, 0, len(args))
	val := ""
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == name:
			if i+1 >= len(args) {
				fatal("%s needs a value", name)
			}
			val = args[i+1]
			i++ // skip the value
		case strings.HasPrefix(a, name+"="):
			val = strings.TrimPrefix(a, name+"=")
		default:
			rest = append(rest, a)
		}
	}
	return rest, val
}

// extractBoolFlag pulls a valueless "--name" out of args, returning the
// remaining args and whether the flag was present.
func extractBoolFlag(args []string, name string) ([]string, bool) {
	rest := make([]string, 0, len(args))
	found := false
	for _, a := range args {
		if a == name {
			found = true
			continue
		}
		rest = append(rest, a)
	}
	return rest, found
}

// filterToPage returns only the page with the given number (or exits if absent).
func filterToPage(pages []Page, pageNum int) []Page {
	for _, p := range pages {
		if p.Page == pageNum {
			return []Page{p}
		}
	}
	fatal("page %d not found in story", pageNum)
	return nil
}

func optArg(args []string, i int, def string) string {
	if i < len(args) {
		return args[i]
	}
	return def
}

func usage() {
	fmt.Fprint(os.Stderr, `social-story - illustrate a social story with OpenAI

Requires: OPENAI_API_KEY

Commands:
  parse    story.txt [story.json]       split the story into pages and save the JSON
  base                                  build the character-sheet anchor from photos/
  title    story.json [outDir]          build the book-cover (title) page -> outDir/title.png
             --note "..."                 extra art direction for the cover (e.g. a flag, map outline)
  generate story.json [outDir]          generate one image per page from a JSON file
             --page N                     generate only page N (test one before a full run)
             --limit N                    generate only the first N pages
             --caption                    render the page text into a bottom band (deterministic)
  redo     story.json <pages> [outDir]  regenerate page(s) as new variants (page2_1, page2_2...);
                                          <pages> is one page or a comma/range list, e.g. 3 or 2,4,14 or 2-5,9
                                          multiple pages run concurrently (tune with --concurrency N)
             --caption                    also add the text band
  caption  story.json [outDir]          add the text band to already-generated page images
             --page 2,4,10                only caption these page(s) (single/comma/range; not idempotent)
  pdf      story.json [outDir]          combine the page images into one PDF in final_stories/
                                          (uses outDir/title.png as the first page when present)

Options (any command):
  --chat-model NAME    chat model for parsing + photo selection (default gpt-5.5)
  --image-model NAME   image model for generation (default gpt-image-2)
  --base PATH          character-sheet anchor image path (default character_base.png)
  --concurrency N      pages generated at once (default 10; lower if you hit rate limits)
  --retries N          retries on transient 429/5xx errors (default 3)

  Chat models:  gpt-5.5 (default), gpt-5.5-pro, gpt-5.4, gpt-5.4-mini,
                gpt-5.4-nano, gpt-4o (availability varies by account)
  Image models: gpt-image-2 (best, default), gpt-image-1.5, gpt-image-1,
                gpt-image-1-mini (cheapest). dall-e-3 does NOT support personal photos.

Typical order: parse -> base -> title -> generate --page 1 (test) -> generate (all) -> pdf

outDir defaults to ./images
`)
}

func fatal(format string, a ...any) {
	fmt.Fprintf(os.Stderr, "error: "+format+"\n", a...)
	os.Exit(1)
}
