const GIPHY_SEARCH_URL = "https://api.giphy.com/v1/gifs/search";

export interface ReactionGif {
  url: string;
  width: number;
  height: number;
}

// Buckets a result into a mood term rather than searching the literal tier
// name — tier names are fandom-flavored and often too specific/nonsensical
// ("Diane's Ghostwriter") to reliably return a good reaction GIF, whereas a
// broad mood term does.
function moodQuery(accuracy: number): string {
  if (accuracy >= 90) return "epic win celebration";
  if (accuracy >= 70) return "nailed it";
  if (accuracy >= 40) return "so close";
  return "fail cringe";
}

// Purely decorative — a Giphy outage or a missing key should never break the
// result page, so every failure path here returns null rather than throwing.
export async function fetchReactionGif(accuracy: number): Promise<ReactionGif | null> {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      q: moodQuery(accuracy),
      limit: "12",
      rating: "pg-13",
    });
    const res = await fetch(`${GIPHY_SEARCH_URL}?${params}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const data = await res.json();
    const gifs: unknown[] = data?.data ?? [];
    if (gifs.length === 0) return null;

    const pick = gifs[Math.floor(Math.random() * gifs.length)] as {
      images?: { fixed_height?: { url?: string; width?: string; height?: string } };
    };
    const image = pick.images?.fixed_height;
    if (!image?.url) return null;

    return { url: image.url, width: Number(image.width), height: Number(image.height) };
  } catch {
    return null;
  }
}
