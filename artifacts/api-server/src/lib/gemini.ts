import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger";

const apiKey = process.env.GEMINI_API_KEY;
const isPlaceholder = !apiKey || apiKey === "Your_Gemini_API_Key";

if (isPlaceholder) {
  logger.warn("⚠️ GEMINI_API_KEY is not configured yet. Get a free key at https://aistudio.google.com/apikey and paste it in your root .env file.");
}

const genAI = new GoogleGenerativeAI(isPlaceholder ? "dummy_key" : apiKey!);

export const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
export { genAI };
