import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "Your_Gemini_API_Key") {
  console.error("No API key found!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const models = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
  "gemini-3.5-flash",
];

async function run() {
  for (const m of models) {
    console.log(`\n--- Testing Model: ${m} ---`);
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent("Respond with the word SUCCESS if you can read this message.");
      console.log(`Result for ${m}:`, result.response.text().trim());
      console.log(`✅ ${m} is WORKING!`);
    } catch (err) {
      console.error(`❌ ${m} FAILED:`, err.message || err);
    }
  }
}

run();
