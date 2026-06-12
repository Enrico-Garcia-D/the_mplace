/**
 * Minimal Gemini client for Expo/React Native.
 *
 * Notes:
 * - Do NOT ship an API key to the client in production.
 * - For local/dev, this uses fetch directly from the app.
 * - Recommended: proxy through your own backend.
 */

type Role = "user" | "model";

export type GeminiChatMessage = {
  role: Role;
  parts: { text: string }[];
};

export type GenerateReplyParams = {
  apiKey: string;
  model?: string;
  fallbackModels?: string[];
  prompt: string;
  chatHistory?: GeminiChatMessage[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
};

function defaultModel() {
  // Gemini models evolve; this is a common general-purpose endpoint.
  return "gemini-3.5-flash";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientGeminiError(status: number) {
  return status === 429 || status === 500 || status === 503;
}

function getModelAttempts(model: string, fallbackModels: string[] = []) {
  return [model, ...fallbackModels].filter(Boolean);
}

export async function generateGeminiReply({
  apiKey,
  model = defaultModel(),
  fallbackModels = [],
  prompt,
  chatHistory = [],
  systemInstruction,
  temperature = 0.7,
  maxOutputTokens = 256,
  responseMimeType,
  responseSchema,
}: GenerateReplyParams): Promise<string> {
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Set EXPO_PUBLIC_GEMINI_API_KEY for dev (client-side) or use a backend proxy.",
    );
  }

  // Gemini REST API: https://ai.google.dev/gemini-api/docs
  // Using:
  // POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
  const body = {
    contents: [
      // include previous turns if available
      ...chatHistory.map((m) => ({
        role: m.role === "model" ? "model" : "user",
        parts: m.parts,
      })),
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    ...(systemInstruction
      ? {
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
        }
      : {}),
    generationConfig: {
      temperature,
      topP: 0.9,
      maxOutputTokens,
      ...(responseMimeType ? { responseMimeType } : {}),
      ...(responseSchema ? { responseSchema } : {}),
    },
  };

  const modelsToTry = getModelAttempts(model, fallbackModels);
  let lastError: Error | null = null;

  for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex += 1) {
    const currentModel = modelsToTry[modelIndex];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      currentModel,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const candidate = data?.candidates?.[0];
        const part0 = candidate?.content?.parts?.[0];
        const replyText = part0?.text;

        return String(replyText ?? "").trim();
      }

      const text = await res.text().catch(() => "");
      const detail = text.trim();
      const msg = detail
        ? `Gemini request failed for ${currentModel} (${res.status}): ${detail}`
        : `Gemini request failed for ${currentModel} (${res.status})`;
      lastError = new Error(msg);

      if (!isTransientGeminiError(res.status) || attempt === maxAttempts) {
        break;
      }

      await sleep(250 * attempt);
    }
  }

  throw lastError ?? new Error("Gemini request failed.");
}

export function getGeminiApiKey() {
  // Expo exposes env vars with EXPO_PUBLIC_ prefix to JS bundle.
  // For production, use a backend.
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY;
}
