import { GoogleGenAI, type Schema } from "@google/genai";

export const GEMINI_MODEL = "gemini-2.5-flash-lite";

export type GeminiFailure = "missing_key" | "rate_limited" | "bad_output" | "api_error";

export class GeminiError extends Error {
  constructor(
    public readonly kind: GeminiFailure,
    message: string,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new GeminiError("missing_key", "GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * One structured-output call with schema-constrained JSON, validated by the
 * caller's parser (zod). Retries once on malformed output with a nudged
 * temperature — the only tolerated failure mode on the free tier.
 */
export async function generateStructured<T>(opts: {
  prompt: string;
  responseSchema: Schema;
  parse: (raw: unknown) => T;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<T> {
  const { prompt, responseSchema, parse } = opts;
  const attempts = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    let text: string | undefined;
    try {
      const res = await getClient().models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: (opts.temperature ?? 0.7) + attempt * 0.15,
          maxOutputTokens: opts.maxOutputTokens ?? 32768,
        },
      });
      text = res.text;
    } catch (err) {
      if (err instanceof GeminiError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      if (/429|RESOURCE_EXHAUSTED|quota/i.test(message)) {
        throw new GeminiError("rate_limited", message);
      }
      // transient API errors get the retry too
      lastError = err;
      continue;
    }

    try {
      if (!text) throw new Error("empty response");
      return parse(JSON.parse(text));
    } catch (err) {
      lastError = err;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new GeminiError("bad_output", `Gemini output failed validation: ${detail}`);
}
