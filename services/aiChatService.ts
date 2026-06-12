import { generateGeminiReply } from "./geminiService";
import type { GeminiChatMessage } from "./geminiService";

export type AiChatAssistParams = {
  /** The text user is sending */
  userText: string;
  /** Context about the listing/conversation */
  listingContext?: {
    listingTitle?: string;
    listingPrice?: string;
    sellerName?: string;
    buyerName?: string;
  };
  /** Full chat history (oldest -> newest) */
  chatHistory?: { role: "user" | "model"; text: string }[];
  /** Gemini API key (or use env via geminiService) */
  apiKey: string;
};

function buildSystemPrompt(ctx?: AiChatAssistParams["listingContext"]) {
  const title = ctx?.listingTitle ? `Listing: ${ctx.listingTitle}` : "";
  const price = ctx?.listingPrice ? `Price: ${ctx.listingPrice}` : "";
  const seller = ctx?.sellerName ? `Seller: ${ctx.sellerName}` : "";
  const buyer = ctx?.buyerName ? `Buyer: ${ctx.buyerName}` : "";

  const meta = [title, price, seller, buyer].filter(Boolean).join("\n");

  return (
    "You are an AI assistant helping a marketplace buyer and seller communicate politely and effectively. " +
    "Your job is to draft a helpful, context-aware reply message. " +
    "Be concise (1-3 short sentences). " +
    "Do NOT mention you are an AI. " +
    "Do NOT include markdown or bullet lists unless the user asks. " +
    (meta ? `\n${meta}` : "") +
    "\n\nReply as the person on the other side of the chat (seller or buyer), matching the tone." 
  );
}

export async function generateAiChatReply({
  userText,
  listingContext,
  chatHistory = [],
  apiKey,
}: AiChatAssistParams): Promise<string> {
  const systemPrompt = buildSystemPrompt(listingContext);

  const history: GeminiChatMessage[] = chatHistory.map((m) => ({
    role: m.role === "model" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  // We use: systemPrompt + userText as the prompt.
  // For Gemini v1beta generateContent, the "contents" array is the whole conversation.
  // We'll prepend systemPrompt to the first user message by including it in prompt.
  const prompt = `${systemPrompt}\n\nUser message: ${userText}\n\nDraft reply:`;

  return generateGeminiReply({
    apiKey,
    prompt,
    model: "gemini-3.5-flash",
    fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash"],
    chatHistory: history,
  });
}

