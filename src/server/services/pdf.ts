import { PDFDocument } from "pdf-lib"

/**
 * Assemble one PDF page per PNG buffer, in order. Each page is sized to its
 * image (points = pixels at 72dpi) and the image is drawn full-bleed. Pure-ish:
 * Buffers in, a Buffer out, no I/O.
 */
export async function assemblePdf(images: Buffer[]): Promise<Buffer> {
  const doc = await PDFDocument.create()

  for (const png of images) {
    const embedded = await doc.embedPng(png)
    const page = doc.addPage([embedded.width, embedded.height])
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height,
    })
  }

  return Buffer.from(await doc.save())
}
