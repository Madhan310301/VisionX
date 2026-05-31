import { Router, type IRouter } from "express";
import { SynthesizeSpeechBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/tts/synthesize", async (req, res): Promise<void> => {
  const parsed = SynthesizeSpeechBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { text } = parsed.data;

  if (!text || text.trim().length === 0) {
    res.status(400).json({ error: "Text is required" });
    return;
  }

  // TTS is now handled client-side via browser SpeechSynthesis API.
  // This endpoint remains for API contract compatibility.
  res.json({ audioBase64: "", format: "browser", message: "Use browser SpeechSynthesis" });
});

export default router;
