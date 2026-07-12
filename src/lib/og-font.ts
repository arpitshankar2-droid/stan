// Satori (next/og's renderer) doesn't read next/font's CSS — it needs raw
// font bytes via the `fonts` option, and only reliably parses TTF/OTF, not
// the woff2 files next/font actually serves to the browser. Google's CSS API
// serves TTF to a plain server-side fetch with no browser-like headers
// (verified directly: `format('truetype')` comes back, not woff2) — no
// user-agent spoofing trick needed.
async function fetchGoogleFontTtf(family: string, weight: number, italic: boolean): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@${italic ? 1 : 0},${weight}&display=swap`;
    const css = await (await fetch(cssUrl)).text();
    const match = css.match(/src: url\(([^)]+)\) format\('truetype'\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    return await fontRes.arrayBuffer();
  } catch {
    // A network hiccup here shouldn't take down the whole OG image — the
    // caller falls back to satori's default font instead.
    return null;
  }
}

export interface OgFonts {
  archivoDisplay: ArrayBuffer | null; // italic 800, for the display face
  archivoBody: ArrayBuffer | null; // normal 400, for regular text
}

export async function loadOgFonts(): Promise<OgFonts> {
  const [archivoDisplay, archivoBody] = await Promise.all([
    fetchGoogleFontTtf("Archivo", 800, true),
    fetchGoogleFontTtf("Archivo", 400, false),
  ]);
  return { archivoDisplay, archivoBody };
}
