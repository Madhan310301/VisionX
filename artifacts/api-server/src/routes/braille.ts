import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  ProcessBrailleImageBody,
  CorrectBrailleTextBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/braille/process", async (req, res): Promise<void> => {
  const parsed = ProcessBrailleImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { imageBase64, mimeType, mode } = parsed.data;
  const start = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an expert Braille OCR system. Analyze this image containing embossed Braille text.

Your task:
1. Detect all Braille cells and dots in the image
2. Reconstruct the correct reading order (left-to-right, top-to-bottom, line by line)
3. Decode each Braille cell into its corresponding character using Grade 1 and Grade 2 Braille standards
4. Assemble the full decoded text maintaining paragraph and line structure
5. Identify any low-confidence regions or quality issues

Respond ONLY with a valid JSON object in this exact format:
{
  "rawText": "the decoded braille text here",
  "confidence": 0.85,
  "lineCount": 5,
  "regions": [
    {"x": 10, "y": 20, "width": 50, "height": 30, "confidence": 0.9}
  ],
  "warnings": ["slight blur detected in top-left region"]
}

Rules:
- confidence is a number 0.0-1.0 (overall page confidence)
- lineCount is the number of Braille lines detected
- regions is an array of detected Braille cell regions (normalized 0-100 coordinate space, max 10 regions)
- warnings is an array of quality issues (empty array if none)
- rawText should preserve line breaks with \\n
- If no Braille is detected, set rawText to "" and confidence to 0.0
- Do not include any explanation outside the JSON`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(400).json({ error: "Failed to parse Braille detection result" });
      return;
    }

    let result: {
      rawText?: string;
      confidence?: number;
      lineCount?: number;
      regions?: Array<{ x: number; y: number; width: number; height: number; confidence: number }>;
      warnings?: string[];
    };
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      res.status(400).json({ error: "Invalid JSON from vision model" });
      return;
    }

    const processingMs = Date.now() - start;

    res.json({
      rawText: result.rawText ?? "",
      confidence: Math.max(0, Math.min(1, result.confidence ?? 0)),
      lineCount: result.lineCount ?? 0,
      regions: result.regions ?? [],
      processingMs,
      warnings: result.warnings ?? [],
      ...(mode ? {} : {}),
    });
  } catch (err) {
    req.log.error({ err }, "Braille processing error");
    res.status(500).json({ error: "Processing failed" });
  }
});

router.post("/braille/correct", async (req, res): Promise<void> => {
  const parsed = CorrectBrailleTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rawText } = parsed.data;

  if (!rawText || rawText.trim().length === 0) {
    res.json({ correctedText: "", changesApplied: 0 });
    return;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are a post-processor for Braille OCR output. You receive raw decoded Braille text that may have minor errors, incorrect spacing, missing punctuation, or capitalization issues due to OCR imperfections. Your job is to produce a clean, grammatically correct English version while preserving the original meaning as closely as possible. Do not add content that wasn't in the original. Respond ONLY with a JSON object: {"correctedText": "...", "changesApplied": N} where N is the approximate number of corrections made.`,
        },
        {
          role: "user",
          content: `Raw Braille OCR output:\n\n${rawText}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.json({ correctedText: rawText, changesApplied: 0 });
      return;
    }

    let result: { correctedText?: string; changesApplied?: number };
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      res.json({ correctedText: rawText, changesApplied: 0 });
      return;
    }

    res.json({
      correctedText: result.correctedText ?? rawText,
      changesApplied: result.changesApplied ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Text correction error");
    res.json({ correctedText: rawText, changesApplied: 0 });
  }
});

export default router;
