import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("No API key found!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    // Wait, let's see if we can call listModels
    // For Node SDK, the client for listModels is obtained differently in some versions, 
    // let's try calling it or let's try to query basic models
    console.log("Listing models is sometimes not supported directly on genAI. Let's try to search the API directly using fetch!");
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log("Models:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error listing models:", err);
  }
}

run();
