import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get(["/health", "/healthz"], (_req, res) => {
  res.json({
    status: "ok",
    message: "NeuroDot Braille API - Zero API dependencies",
    features: {
      cvProcessing: "✅ Local OpenCV",
      ollama: "⚠️  Optional (enhanced corrections)",
      tts: "✅ Local pyttsx3 or Web Speech API",
      dictation: "✅ Web Speech API",
      corrections: "✅ Rule-based (100% offline)",
    },
  });
});

export default router;
