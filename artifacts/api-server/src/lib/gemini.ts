import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger";

const apiKey = process.env.GEMINI_API_KEY;
const isPlaceholder = !apiKey || apiKey === "Your_Gemini_API_Key";

export let geminiModel: any = undefined;
export let genAI: any = undefined;
export let hasGemini = false;

if (isPlaceholder) {
  // Do not instantiate the client when no valid key is provided to avoid
  // accidental network calls and noisy library warnings. Consumers should
  // check `hasGemini` before attempting to use the model.
  logger.info("GEMINI_API_KEY not set — Gemini correction layer disabled.");
} else {
  const genAIInstance = new GoogleGenerativeAI(apiKey!);
  const geminiModelInstance = genAIInstance.getGenerativeModel({ model: "gemini-2.5-flash" });
  genAI = genAIInstance;
  geminiModel = geminiModelInstance;
  hasGemini = true;
}
