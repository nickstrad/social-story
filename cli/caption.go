package main

// Deterministic caption rendering. Rather than asking the image model to draw
// the page text (non-deterministic, risk of misspelling), we render the exact
// story text into a caption band ourselves with the freetype package. Same font,
// same band, correct spelling on every page, every run.

import (
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"os"

	"github.com/golang/freetype"
	"github.com/golang/freetype/truetype"
	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/goregular"
)

// Caption styling. Sizes are relative to the image width so any image size works.
var (
	captionBandColor = color.RGBA{0xEA, 0xE2, 0xF6, 0xFF} // soft lavender band
	captionTextColor = color.RGBA{0x2B, 0x2B, 0x2B, 0xFF} // near-black text
	captionFontFrac  = 1.0 / 24.0                         // font size as fraction of width
	captionPadFrac   = 1.0 / 20.0                         // band padding as fraction of width
	captionLineFrac  = 1.35                               // line height as multiple of font size
)

// addCaption reads the image at srcPath, appends a bottom band containing text
// (wrapped and centered), and writes the result to dstPath. src and dst may be
// the same file. The band is added BELOW the artwork so no illustration is
// covered. A blank text leaves the image unchanged (copied through).
func addCaption(srcPath, dstPath, text string) error {
	srcFile, err := os.Open(srcPath)
	if err != nil {
		return fmt.Errorf("opening image: %w", err)
	}
	src, err := png.Decode(srcFile)
	srcFile.Close()
	if err != nil {
		return fmt.Errorf("decoding png: %w", err)
	}

	ttf, err := truetype.Parse(goregular.TTF)
	if err != nil {
		return fmt.Errorf("parsing font: %w", err)
	}

	w := src.Bounds().Dx()
	h := src.Bounds().Dy()
	fontSize := float64(w) * captionFontFrac
	pad := int(float64(w) * captionPadFrac)
	lineHeight := int(fontSize * captionLineFrac)

	face := truetype.NewFace(ttf, &truetype.Options{Size: fontSize, DPI: 72, Hinting: font.HintingFull})
	defer face.Close()

	// Wrap the text to fit the width minus horizontal padding.
	maxTextWidth := w - 2*pad
	lines := wrapText(text, face, maxTextWidth)
	bandHeight := 2*pad + len(lines)*lineHeight

	// Compose: original artwork on top, solid band beneath.
	out := image.NewRGBA(image.Rect(0, 0, w, h+bandHeight))
	draw.Draw(out, image.Rect(0, 0, w, h), src, src.Bounds().Min, draw.Src)
	draw.Draw(out, image.Rect(0, h, w, h+bandHeight), image.NewUniform(captionBandColor), image.Point{}, draw.Src)

	// Draw each wrapped line, centered, inside the band.
	c := freetype.NewContext()
	c.SetDPI(72)
	c.SetFont(ttf)
	c.SetFontSize(fontSize)
	c.SetClip(out.Bounds())
	c.SetDst(out)
	c.SetSrc(image.NewUniform(captionTextColor))
	c.SetHinting(font.HintingFull)

	ascent := int(fontSize) // approximate baseline offset from line top
	for i, line := range lines {
		lineW := font.MeasureString(face, line).Ceil()
		x := max((w-lineW)/2, pad)
		y := h + pad + i*lineHeight + ascent
		if _, err := c.DrawString(line, freetype.Pt(x, y)); err != nil {
			return fmt.Errorf("drawing caption: %w", err)
		}
	}

	dstFile, err := os.Create(dstPath)
	if err != nil {
		return fmt.Errorf("creating output: %w", err)
	}
	defer dstFile.Close()
	return png.Encode(dstFile, out)
}

// wrapText greedily breaks text into lines that each fit within maxWidth for the
// given font face.
func wrapText(text string, face font.Face, maxWidth int) []string {
	words := splitWords(text)
	if len(words) == 0 {
		return []string{""}
	}
	var lines []string
	current := words[0]
	for _, word := range words[1:] {
		candidate := current + " " + word
		if font.MeasureString(face, candidate).Ceil() <= maxWidth {
			current = candidate
		} else {
			lines = append(lines, current)
			current = word
		}
	}
	lines = append(lines, current)
	return lines
}

// splitWords splits on whitespace, collapsing runs of spaces/newlines.
func splitWords(s string) []string {
	var words []string
	var cur []rune
	for _, r := range s {
		if r == ' ' || r == '\n' || r == '\t' || r == '\r' {
			if len(cur) > 0 {
				words = append(words, string(cur))
				cur = cur[:0]
			}
			continue
		}
		cur = append(cur, r)
	}
	if len(cur) > 0 {
		words = append(words, string(cur))
	}
	return words
}
