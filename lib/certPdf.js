// Certificate PDF generation, run in the browser with pdf-lib.
// One PDF per student: the template image fills the whole page and
// the student's name is drawn on it as real, selectable text with
// the embedded font. Nothing is stretched: the page size follows
// the template's own aspect ratio, so the design is never distorted
// (the Python script stretched the template to fill A4).

import { PDFDocument } from "pdf-lib";
// pdf-lib cannot embed a custom TTF on its own: a fontkit
// instance must be registered on each document first, or embedFont
// throws FontkitNotRegisteredError. fontkit is pdf-lib's official
// companion package for this. This is the only extra package the
// generator needs.
import fontkit from "@pdf-lib/fontkit";
import { fitFontSize, findMissingGlyphs } from "./certNames.js";

// A4 landscape is 842 x 595 points. If the template is A4-ratio,
// the page is exactly that; otherwise the height stays 595pt and
// the width follows the template's aspect ratio.
export function pageSizeForAspect(aspect) {
  if (Math.abs(aspect - 842 / 595) < 0.01) return { width: 842, height: 595 };
  return { width: Math.round(595 * aspect), height: 595 };
}

// "jpg" or "png", from the template URL. Only these two can be
// embedded in a PDF, which is why the template upload only accepts
// JPG and PNG.
export function templateTypeFromUrl(url) {
  const lower = String(url || "").split("?")[0].toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  if (lower.endsWith(".png")) return "png";
  return null;
}

// How far above the bottom edge of the name box the text baseline
// sits. The box marks the line the name sits on, so the baseline
// is a small gap above the box bottom, mirroring the script.
function baselineGap(size) {
  return Math.max(4, Math.round(size * 0.08));
}

// Generate one certificate PDF.
// - templateBytes: the template image bytes (JPG or PNG).
// - templateType: "jpg" | "png".
// - fontBytes: the chosen TTF bytes.
// - printedName: the name as it should appear (already tidied, or
//   the admin's edited override).
// - box: { x, y, w, h } fractions of the image size, measured from
//   the top-left corner, exactly as stored per event.
// - size: preferred name size in points; shrinks to fit the box.
// - title: PDF title metadata, "Certificate of Participation - <name>".
// Returns { bytes, fittedSize, missingGlyphs }. When the font
// cannot print a character in the name, bytes is null: that
// student gets no PDF and the review screen shows the warning.
export async function generateCertificatePdf({
  templateBytes,
  templateType,
  fontBytes,
  printedName,
  box,
  size,
  title,
}) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const image =
    templateType === "jpg" ? await doc.embedJpg(templateBytes) : await doc.embedPng(templateBytes);
  const aspect = image.width / image.height;
  const { width, height } = pageSizeForAspect(aspect);
  const page = doc.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });

  const font = await doc.embedFont(fontBytes);
  // The glyph check runs on the fontkit font, which knows the
  // font's glyph set; the pdf-lib font is only for drawing.
  const fkFont = fontkit.create(fontBytes);
  const missingGlyphs = findMissingGlyphs(fkFont, printedName);
  // A name with a missing glyph gets NO pdf at all: the caller
  // leaves that student out of the batch and shows the warning
  // instead, so a half-broken name can never be saved or sent.
  if (missingGlyphs.length > 0) {
    return { bytes: null, fittedSize: size, missingGlyphs };
  }
  const boxWidthPt = box.w * width;
  const fittedSize = fitFontSize(font, printedName, size, boxWidthPt - 8);
  const textWidth = font.widthOfTextAtSize(printedName, fittedSize);
  const boxCentreX = (box.x + box.w / 2) * width;
  const boxBottomFromTop = (box.y + box.h) * height;
  const baselineY = height - boxBottomFromTop + baselineGap(fittedSize);
  page.drawText(printedName, {
    x: boxCentreX - textWidth / 2,
    y: baselineY,
    size: fittedSize,
    font,
  });
  doc.setTitle(title || `Certificate of Participation - ${printedName}`);
  const bytes = await doc.save();
  return { bytes, fittedSize, missingGlyphs };
}

// Check one printed name against a font without making a PDF:
// returns { fittedSize, missingGlyphs } for the review screen when
// the admin edits a name. `pageWidth` is the PDF page width the
// name will be drawn on (from pageSizeForAspect).
export async function checkPrintedName({ fontBytes, printedName, box, size, pageWidth }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes);
  const fkFont = fontkit.create(fontBytes);
  const missingGlyphs = findMissingGlyphs(fkFont, printedName);
  const printable = [...printedName].filter((ch) => fkFont.hasGlyphForCodePoint(ch.codePointAt(0))).join("");
  const fittedSize = fitFontSize(font, printable || printedName, size, box.w * pageWidth - 8);
  return { fittedSize, missingGlyphs };
}
