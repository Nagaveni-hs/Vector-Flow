// Certificate name helpers, plain functions with no React in them,
// so they can be tested with plain node. They mirror the rules of
// Shashank's Python script (generate_certificates.py), with the
// gaps fixed: no Excel, no filename matching, and a bad glyph flags
// one student instead of stopping the whole batch.

// The two fonts an admin can pick for a certificate, one per event.
// The files live in public/fonts/ and are fetched from the same
// origin at generation time. Both are SIL Open Font Licence fonts
// from Google Fonts.
export const CERT_FONTS = [
  { id: "lora", label: "Lora Bold", file: "Lora-Bold.ttf" },
  { id: "hanken", label: "Hanken Grotesk Bold", file: "HankenGrotesk-Bold.ttf" },
];

export function certFontById(id) {
  return CERT_FONTS.find((f) => f.id === id) || null;
}

// Default name box, as fractions of the template image size.
// Centred, a little below the middle, where most certificate
// templates leave a line for the name. The admin moves and resizes
// it on the template preview; this is only the starting point.
export const DEFAULT_CERT_BOX = { x: 0.2, y: 0.55, w: 0.6, h: 0.12 };

// Default name size in PDF points, the same 66 the Python script
// used for participant names.
export const DEFAULT_CERT_SIZE = 66;

// Smart capitalisation, mirroring the Python script:
// "SURESH" -> "Suresh", "kumar" -> "Kumar", initials like "TS"
// stay capitals, "swarna.s" -> "Swarna.S", mixed case is kept.
// Extra spaces are collapsed. Letters are split on runs of
// non-letters, so dots and hyphens survive untouched.
function tidyWord(word) {
  // Split into letter runs and the separators between them.
  const parts = word.split(/([^\p{L}]+)/u);
  return parts
    .map((part) => {
      if (!part || !/\p{L}/u.test(part)) return part;
      const letters = [...part];
      const isAllUpper = letters.every((c) => c === c.toUpperCase() && c !== c.toLowerCase());
      const isAllLower = letters.every((c) => c === c.toLowerCase() && c !== c.toUpperCase());
      if (isAllUpper && letters.length > 2) {
        return letters[0].toUpperCase() + letters.slice(1).join("").toLowerCase();
      }
      if (isAllUpper) return part; // short all-caps run: initials, keep them.
      if (isAllLower) {
        return letters[0].toUpperCase() + letters.slice(1).join("").toLowerCase();
      }
      return part; // mixed case, e.g. "McDonald": keep as typed.
    })
    .join("");
}

export function tidyName(raw) {
  if (!raw) return "";
  return String(raw)
    .trim()
    .split(/\s+/)
    .map(tidyWord)
    .join(" ");
}

// Safe PDF base name (no ".pdf" on the end; the caller adds it).
// Illegal file characters and control characters are stripped,
// trailing spaces and dots are trimmed, and an empty result falls
// back to "participant". Names are deduped case-insensitively:
// the second "Suresh Kumar" becomes "Suresh Kumar (2)", then
// " (3)", and so on. `usedSet` holds lower-cased names already
// taken, and the chosen name is added to it.
export function safeFilename(name, usedSet) {
  let base = String(name || "")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim()
    .replace(/[. ]+$/, "");
  if (!base) base = "participant";
  const used = usedSet || new Set();
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} (${n})`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

// Shrink-only font fit: the size never grows above the preferred
// size, it only comes down until the text fits inside maxWidth.
// `font` is an embedded pdf-lib font (widthOfTextAtSize).
export function fitFontSize(font, text, preferredSize, maxWidth) {
  let size = preferredSize;
  while (size > 8 && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }
  return size;
}

// Glyph safety: returns the distinct characters in `text` that
// this font cannot print. `font` is a fontkit font (from
// fontkit.create(fontBytes)): fontkit is the one that knows the
// font's glyph set; pdf-lib's embedded font has no such check.
// One bad character flags one student; the rest of the batch is
// untouched.
export function findMissingGlyphs(font, text) {
  const missing = [];
  const seen = new Set();
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    if (!font.hasGlyphForCodePoint(cp) && !seen.has(ch)) {
      seen.add(ch);
      missing.push(ch);
    }
  }
  return missing;
}
