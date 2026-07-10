package main

// PDF export. Collects the already-generated page images (page1.png, page2.png,
// ...) in story order and lays them out one-per-page into a single PDF so the
// whole book can be printed or shared as one file. This is fully deterministic
// and calls no AI model: it only reads the existing images.

import (
	"fmt"
	"image"
	_ "image/png"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-pdf/fpdf"
)

// finalStoriesDir is where finished, shareable PDFs are written.
const finalStoriesDir = "final_stories"

// buildPDF assembles one PDF from the page images in outDir, in story page
// order, and writes it to final_stories/<name>.pdf. Each image becomes one PDF
// page sized to the image (in points) so nothing is cropped or distorted. Pages
// whose image file is missing are skipped with a notice.
func buildPDF(story Story, outDir, pdfPath string) error {
	pdf := fpdf.New("P", "pt", "A4", "")
	pdf.SetAutoPageBreak(false, 0)

	added := 0

	// The optional cover (title.png) always comes first, before page 1.
	if cover := filepath.Join(outDir, titleImageName); fileExists(cover) {
		if err := addImagePage(pdf, cover); err != nil {
			return err
		}
		added++
	}

	for _, p := range story.Pages {
		img := filepath.Join(outDir, fmt.Sprintf("page%d.png", p.Page))
		if !fileExists(img) {
			fmt.Printf("  (skipping page %d: %s not found)\n", p.Page, img)
			continue
		}
		if err := addImagePage(pdf, img); err != nil {
			return err
		}
		added++
	}

	if added == 0 {
		return fmt.Errorf("no page images found in %s", outDir)
	}
	if err := pdf.OutputFileAndClose(pdfPath); err != nil {
		return fmt.Errorf("writing pdf: %w", err)
	}
	fmt.Printf("Wrote %d page(s) -> %s\n", added, pdfPath)
	return nil
}

// addImagePage adds one PDF page sized to the image (in points) and draws the
// image to fill it, so nothing is cropped or distorted.
func addImagePage(pdf *fpdf.Fpdf, imgPath string) error {
	f, err := os.Open(imgPath)
	if err != nil {
		return fmt.Errorf("opening %s: %w", imgPath, err)
	}
	cfg, _, decErr := image.DecodeConfig(f)
	f.Close()
	if decErr != nil {
		return fmt.Errorf("reading %s: %w", imgPath, decErr)
	}
	w, h := float64(cfg.Width), float64(cfg.Height)
	pdf.AddPageFormat("P", fpdf.SizeType{Wd: w, Ht: h})
	pdf.ImageOptions(imgPath, 0, 0, w, h, false,
		fpdf.ImageOptions{ImageType: "PNG", ReadDpi: false}, 0, "")
	return nil
}

// fileExists reports whether path exists and is readable as a regular file.
func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

// mustPDF builds the whole-story PDF into final_stories/, deriving the file name
// from the story title (falling back to the JSON file name).
func mustPDF(story Story, outDir, jsonPath string) {
	if err := os.MkdirAll(finalStoriesDir, 0o755); err != nil {
		fatal("creating %s: %v", finalStoriesDir, err)
	}
	pdfPath := filepath.Join(finalStoriesDir, pdfName(story, jsonPath))
	if err := buildPDF(story, outDir, pdfPath); err != nil {
		fatal("%v", err)
	}
	fmt.Printf("Done -> %s\n", pdfPath)
}

// pdfName picks a safe output file name: the story title slugified, or the JSON
// base name if the title is empty.
func pdfName(story Story, jsonPath string) string {
	base := slugify(story.Title)
	if base == "" {
		base = strings.TrimSuffix(filepath.Base(jsonPath), filepath.Ext(jsonPath))
	}
	return base + ".pdf"
}

// slugify turns a title into a lowercase, filesystem-safe file stem.
func slugify(s string) string {
	var b strings.Builder
	lastDash := false
	for _, r := range strings.ToLower(strings.TrimSpace(s)) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			lastDash = false
		default:
			if !lastDash && b.Len() > 0 {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}
