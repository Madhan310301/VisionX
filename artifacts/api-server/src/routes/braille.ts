import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  ProcessBrailleImageBody,
  CorrectBrailleTextBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const SYSTEM_DECODERS: Record<string, string> = {
  ueb_grade1: `You are decoding Grade 1 Unified English Braille (UEB). This is a direct letter-by-letter system where each Braille cell maps to exactly one character. Apply the full UEB cell table including capital indicators (⠠), number indicators (⠼), and punctuation cells. Preserve all spacing and line breaks exactly.`,

  ueb_grade2: `You are decoding Grade 2 Unified English Braille (UEB), also called contracted Braille. This system uses shorthand contractions to represent common words and letter groups. Apply ALL standard UEB contractions including whole-word contractions (e.g., ⠮ = "the", ⠯ = "and", ⠾ = "you", ⠿ = "ble"), part-word contractions (e.g., ⠒ = "con", ⠡ = "ch", ⠩ = "sh", ⠬ = "ing"), and letter groups. Expand every contraction to its full English equivalent. Preserve paragraph breaks.`,

  nemeth: `You are decoding Nemeth Braille Code for mathematics and scientific notation. Nemeth uses specialized cell mappings for numbers, operators, fractions, superscripts, subscripts, Greek letters, and mathematical symbols. Decode:
- Numeric indicator (⠼) followed by cells → Arabic numerals
- Superscript/subscript indicators → use proper mathematical notation (^, _)
- Fraction indicators → format as n/d or \\frac{n}{d}
- Operator cells → +, -, ×, ÷, =, <, >, ≤, ≥, ≠
- Greek letter indicator → α, β, γ, π, etc.
Output should be readable mathematical text or LaTeX-style notation where appropriate.`,

  computer: `You are decoding Computer Braille (also called ASCII Braille or 8-dot Braille). This system is used for programming source code, command-line text, and technical symbols. Each cell maps directly to an ASCII character. Apply the computer Braille table to decode all programming symbols including brackets []{}(), operators +-*/=<>&|^~, and punctuation. Preserve whitespace, indentation, and all special characters exactly — they are significant in code.`,

  music: `You are decoding Music Braille notation. Decode:
- Note names (A–G) from cell patterns using the Music Braille note table
- Note values (whole, half, quarter, eighth, sixteenth) from the upper dot patterns
- Octave indicators → specify which octave (e.g., "middle C", "C4")
- Rest symbols → rest (whole/half/quarter/etc.)
- Clef, time signature, key signature indicators
- Dynamic markings (pp, p, mp, mf, f, ff)
- Articulation marks (staccato, legato, accent)
Output as a text description of the musical content in a readable score-like format.`,

  unknown: `You are decoding Braille text of an unidentified system. Apply your best knowledge of all Braille standards (UEB Grade 1/2, Nemeth, Computer, Music) to produce the most likely accurate decoding. Flag ambiguous cells in your warnings.`,
};

router.post("/braille/process", async (req, res): Promise<void> => {
  const parsed = ProcessBrailleImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { imageBase64, mimeType } = parsed.data;
  const start = Date.now();

  try {
    // ── Step 1: Classify the Braille system ──────────────────────────────
    const classifyResponse = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a Braille expert. Examine this image carefully and classify which Braille system or standard it uses.

The possible systems are:
- ueb_grade1: Unified English Braille Grade 1 — direct letter-by-letter, one cell per character, no contractions
- ueb_grade2: Unified English Braille Grade 2 — uses contractions (whole-word and part-word). Most common globally. Used in USA, UK, Canada, Australia, India.
- nemeth: Nemeth Code — Braille for mathematics, equations, fractions, operators, scientific notation
- computer: Computer Braille / ASCII Braille — used for source code, programming characters, 8-dot system
- music: Music Braille — encodes musical notation (notes, rests, dynamics, clefs)
- unknown: Cannot determine with confidence

Evidence to look for:
- Dense contractions and shorthand cells → ueb_grade2
- Numeric indicator ⠼ followed by number cells, operators, fraction signs → nemeth
- 8-dot cells or ASCII-mapped characters, code-like structure → computer
- Note and octave indicators, music-specific cell patterns → music
- Simple letter-by-letter with no contractions → ueb_grade1

Respond ONLY with a JSON object:
{
  "brailleSystem": "ueb_grade2",
  "systemConfidence": 0.92,
  "systemReasoning": "Dense contractions visible including whole-word cells. Consistent with Grade 2 UEB used in educational material."
}`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
            },
          ],
        },
      ],
    });

    const classifyContent = classifyResponse.choices[0]?.message?.content ?? "{}";
    const classifyMatch = classifyContent.match(/\{[\s\S]*\}/);
    let classifyResult: { brailleSystem?: string; systemConfidence?: number; systemReasoning?: string } = {};
    try {
      classifyResult = classifyMatch ? JSON.parse(classifyMatch[0]) : {};
    } catch {
      // fall through with defaults
    }

    const brailleSystem = (classifyResult.brailleSystem as string) ?? "unknown";
    const systemConfidence = Math.max(0, Math.min(1, classifyResult.systemConfidence ?? 0));
    const systemReasoning = classifyResult.systemReasoning ?? "";
    const decoderInstructions = SYSTEM_DECODERS[brailleSystem] ?? SYSTEM_DECODERS.unknown;

    // ── Step 2: Decode with specialized instructions ──────────────────────
    const decodeResponse = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${decoderInstructions}

Now analyze this image and decode ALL Braille content following the rules above.

Additional tasks:
1. Detect all Braille cells and reconstruct the correct reading order (left-to-right, top-to-bottom)
2. Decode each cell using the ${brailleSystem} standard
3. Reconstruct complete sentences, equations, code blocks, or musical phrases
4. Identify any low-confidence or ambiguous regions

Respond ONLY with this JSON:
{
  "rawText": "the fully decoded text here",
  "confidence": 0.87,
  "lineCount": 6,
  "regions": [
    {"x": 10, "y": 20, "width": 50, "height": 30, "confidence": 0.9}
  ],
  "warnings": ["slight blur in bottom-right corner"]
}

Rules:
- confidence is 0.0-1.0 (overall page confidence)
- lineCount is number of Braille lines detected
- regions are detected areas (normalized 0-100 coordinate space, max 10 regions)
- warnings lists quality issues (empty array if none)
- rawText preserves line breaks with \\n
- If no Braille is detected, set rawText to "" and confidence to 0.0`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
            },
          ],
        },
      ],
    });

    const decodeContent = decodeResponse.choices[0]?.message?.content ?? "{}";
    const decodeMatch = decodeContent.match(/\{[\s\S]*\}/);
    if (!decodeMatch) {
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
      result = JSON.parse(decodeMatch[0]);
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
      brailleSystem,
      systemConfidence,
      systemReasoning,
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

  const { rawText, brailleSystem } = parsed.data;

  if (!rawText || rawText.trim().length === 0) {
    res.json({ correctedText: "", changesApplied: 0 });
    return;
  }

  const systemContext: Record<string, string> = {
    ueb_grade1: "The text was decoded from Grade 1 UEB Braille (letter-by-letter). Fix spacing, capitalization, and punctuation only. Do not alter the words themselves.",
    ueb_grade2: "The text was decoded from Grade 2 UEB contracted Braille. Ensure all contractions were correctly expanded into full English words. Fix any missed contractions, spelling, spacing, capitalization, and punctuation.",
    nemeth: "The text was decoded from Nemeth mathematical Braille. Preserve all numbers, operators, fractions, exponents, and mathematical symbols exactly. Only correct obvious OCR artifacts like misread dots. Do not paraphrase equations.",
    computer: "The text was decoded from Computer Braille (source code / ASCII Braille). Preserve all whitespace, indentation, brackets, operators, and special characters exactly as decoded — they are syntactically significant. Only fix characters that are clearly misread.",
    music: "The text was decoded from Music Braille. Preserve all note names, octave markers, duration values, dynamic markings, and musical structure. Only correct obvious misreadings.",
    unknown: "The text was decoded from Braille of unknown type. Apply conservative corrections only — fix obvious spacing and capitalization issues without changing potentially significant characters.",
  };

  const context = systemContext[brailleSystem ?? "unknown"] ?? systemContext.unknown;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are a post-processor for Braille OCR output. ${context}\n\nRespond ONLY with a JSON object: {"correctedText": "...", "changesApplied": N} where N is the number of corrections made.`,
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
