import { getGeminiApiKey, generateGeminiReply } from "./geminiService";

type ModerationCategory =
  | "harassment"
  | "hate"
  | "scam"
  | "personal-data"
  | "sexual"
  | "violence"
  | "self-harm"
  | "other";

type ModerationResult = {
  allowed: boolean;
  category?: ModerationCategory;
  reason?: string;
  rewrite?: string;
};

type ModerationParams = {
  apiKey?: string;
  userText: string;
  listingContext?: {
    listingTitle?: string;
    listingPrice?: string;
    sellerName?: string;
    buyerName?: string;
  };
};

function buildModerationSystemPrompt() {
  return (
    "You are a strict content moderation system for a marketplace chat app. " +
    "Your job is to decide whether the user's message is safe to send as-is. " +
    "Be conservative: if you are unsure, set allowed=false. " +
    "Do NOT output anything except valid JSON with the required fields. " +
    "Return shape: {" +
    '  "allowed": boolean,' +
    '  "category"?: string,' +
    '  "reason"?: string,' +
    '  "rewrite"?: string' +
    "}."
  );
}

function buildModerationUserPrompt(params: ModerationParams): string {
  const ctx = params.listingContext;
  const meta = [
    ctx?.listingTitle ? `Listing: ${ctx.listingTitle}` : null,
    ctx?.listingPrice ? `Price: ${ctx.listingPrice}` : null,
    ctx?.sellerName ? `Seller: ${ctx.sellerName}` : null,
    ctx?.buyerName ? `Buyer: ${ctx.buyerName}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    (meta ? `Context:\n${meta}\n\n` : "") +
    "User message:\n" +
    params.userText +
    "\n\nSafety checks:\n" +
    "- Personal data: phone numbers, emails, addresses, payment details, or any sensitive personal info should be blocked or rewritten.\n" +
    "- Scams/fraud: requests to move off-platform, suspicious links/instructions, or fraud patterns should be blocked.\n" +
    "- Harassment/hate: abusive or hateful content should be blocked.\n" +
    "- Sexual/violent/self-harm content should be blocked.\n\n" +
    "If allowed=false, set category and reason. Optionally provide a safe rewrite in rewrite."
  );
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return trimmed.slice(first, last + 1);
  }

  return null;
}

function normalizeModerationResult(value: unknown): ModerationResult {
  if (!value || typeof value !== "object") {
    return {
      allowed: false,
      category: "other",
      reason: "Moderation returned invalid output.",
    };
  }

  const parsed = value as Partial<ModerationResult> & {
    allowed?: unknown;
    category?: unknown;
    reason?: unknown;
    rewrite?: unknown;
  };

  return {
    allowed: Boolean(parsed.allowed),
    category:
      typeof parsed.category === "string" ? (parsed.category as ModerationCategory) : undefined,
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    rewrite: typeof parsed.rewrite === "string" ? parsed.rewrite : undefined,
  };
}

export async function moderateUserMessage(params: ModerationParams): Promise<ModerationResult> {
  const { apiKey, userText, listingContext } = params;
  const key = apiKey ?? getGeminiApiKey();
  if (!key) {
    // Fail closed: if moderation can't run, allow? Safer: block.
    // For UX you may prefer allow; choose conservative behavior.
    return {
      allowed: false,
      category: "other",
      reason: "Moderation unavailable (missing Gemini API key).",
    };
  }

  const systemPrompt = buildModerationSystemPrompt();
  const prompt = `${systemPrompt}\n\n${buildModerationUserPrompt({
    apiKey: key,
    userText,
    listingContext,
  })}`;

  try {
    const raw = await generateGeminiReply({
      apiKey: key,
      model: "gemini-3.5-flash",
      fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash"],
      prompt,
      chatHistory: [],
      temperature: 0,
      maxOutputTokens: 220,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          allowed: { type: "boolean" },
          category: {
            type: "string",
            enum: [
              "harassment",
              "hate",
              "scam",
              "personal-data",
              "sexual",
              "violence",
              "self-harm",
              "other",
            ],
          },
          reason: { type: "string" },
          rewrite: { type: "string" },
        },
        required: ["allowed"],
      },
    });

    const jsonText = extractJsonObject(raw);
    if (!jsonText) {
      return {
        allowed: false,
        category: "other",
        reason: `Moderation returned invalid output: ${raw.slice(0, 120)}`,
      };
    }

    return normalizeModerationResult(JSON.parse(jsonText));
  } catch (error) {
    // Fail closed for safety: if moderation fails, block the message.
    return {
      allowed: false,
      category: "other",
      reason:
        error instanceof Error && error.message.includes("Gemini request failed")
          ? "Moderation temporarily unavailable; message blocked."
          : "Moderation error; message blocked.",
    };
  }
}
