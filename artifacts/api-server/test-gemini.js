import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
console.log("Using API Key:", apiKey ? apiKey.substring(0, 10) + "..." : "undefined");

  if (!apiKey || apiKey === "Your_Gemini_API_Key") {
  console.error("No API key found in environment!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const models = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

async function run() {
  for (const modelName of models) {
    console.log(`\n--- Testing Model: ${modelName} ---`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Respond with the word SUCCESS if you can read this message.");
      console.log(`Result for ${modelName}:`, result.response.text().trim());
      console.log(`✅ ${modelName} is WORKING!`);
    } catch (err) {
      console.error(`❌ ${modelName} FAILED:`, err.message || err);
    }
  }
}

run();
