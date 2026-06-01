import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger";

const apiKey = process.env.GEMINI_API_KEY;
const isPlaceholder = !apiKey || apiKey === "Your_Gemini_API_Key";

if (isPlaceholder) {
  // Do not instantiate the client when no valid key is provided to avoid
  // accidental network calls and noisy library warnings. Consumers should
  // check `hasGemini` before attempting to use the model.
  logger.info("GEMINI_API_KEY not set — Gemini correction layer disabled.");
  export const geminiModel: undefined = undefined as any;
  export const genAI: undefined = undefined as any;
  export const hasGemini = false;
} else {
  const genAIInstance = new GoogleGenerativeAI(apiKey!);
  const geminiModelInstance = genAIInstance.getGenerativeModel({ model: "gemini-2.5-flash" });
  export const genAI = genAIInstance;
  export const geminiModel = geminiModelInstance;
  export const hasGemini = true;
}
