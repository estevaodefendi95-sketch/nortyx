/**
 * Color utilities — safe hex → HSL conversion for theming.
 */

/**
 * Convert a hex color (#RGB, #RRGGBB) to an "H S% L%" string for CSS variables.
 * Returns null if the input is not a valid hex color, so callers can skip
 * applying a broken theme instead of crashing.
 */
export function hexToHSL(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;

  let hex = input.trim().replace(/^#/, "");

  // Expand shorthand #abc → #aabbcc
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }

  if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) return null;

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  if ([r, g, b].some((v) => Number.isNaN(v))) return null;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
