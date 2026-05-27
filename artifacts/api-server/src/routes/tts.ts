import { Router, type IRouter } from "express";
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";
import { SynthesizeSpeechBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/tts/synthesize", async (req, res): Promise<void> => {
  const parsed = SynthesizeSpeechBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { text, voice } = parsed.data;

  if (!text || text.trim().length === 0) {
    res.status(400).json({ error: "Text is required" });
    return;
  }

  try {
    const audioBuffer = await textToSpeech(text, voice ?? "nova", "mp3");
    const audioBase64 = audioBuffer.toString("base64");
    res.json({ audioBase64, format: "mp3" });
  } catch (err) {
    req.log.error({ err }, "TTS synthesis error");
    res.status(500).json({ error: "Speech synthesis failed" });
  }
});

export default router;
