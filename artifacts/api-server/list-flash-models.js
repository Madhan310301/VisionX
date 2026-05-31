import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("No API key found!");
  process.exit(1);
}

async function run() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    if (data.models) {
      const flashModels = data.models.filter(m => m.name.toLowerCase().includes("flash"));
      console.log("Flash models available:");
      for (const m of flashModels) {
        console.log(`- ${m.name}`);
      }
    } else {
      console.log("No models returned:", data);
    }
  } catch (err) {
    console.error("Error fetching models:", err);
  }
}

run();
