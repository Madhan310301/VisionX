import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  ProcessBrailleImageBody,
  CorrectBrailleTextBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Complete Braille reference tables embedded in the prompt ────────────────
// These give the model ground truth to decode against instead of relying on memory.
const BRAILLE_REFERENCE = `
BRAILLE CELL ANATOMY
Each Braille cell has 6 dot positions arranged in a 2×3 grid:
  Dot 1  Dot 4
  Dot 2  Dot 5
  Dot 3  Dot 6
A "raised" dot = filled circle. An "absent" dot = empty space.
Dots are numbered 1-6. A cell is described by which dots are raised, e.g. "dots 1,2,4" = ⠋.

GRADE 1 UEB / ENGLISH BRAILLE ALPHABET
(dot pattern → character)
dots 1       = a
dots 1,2     = b
dots 1,4     = c
dots 1,4,5   = d
dots 1,5     = e
dots 1,2,4   = f
dots 1,2,4,5 = g
dots 1,2,5   = h
dots 2,4     = i
dots 2,4,5   = j
dots 1,3     = k
dots 1,2,3   = l
dots 1,3,4   = m
dots 1,3,4,5 = n
dots 1,3,5   = o
dots 1,2,3,4 = p
dots 1,2,3,4,5 = q
dots 1,2,3,5 = r
dots 2,3,4   = s
dots 2,3,4,5 = t
dots 1,3,6   = u
dots 1,2,3,6 = v
dots 2,4,5,6 = w
dots 1,3,4,6 = x
dots 1,3,4,5,6 = y
dots 1,3,5,6 = z

SPECIAL INDICATORS
dots 6       = capital indicator (next letter is uppercase)
dots 3,4,5,6 = number indicator (⠼, next cells are digits)
dots 2,3,5,6 = letter indicator
dots 2,5     = decimal point / period
dots 2,3     = comma
dots 2,3,5   = semicolon
dots 2,5,6   = colon
dots 2,3,5,6 = exclamation
dots 2,3,6   = opening quote
dots 3,5,6   = closing quote / apostrophe
dots 3,6     = hyphen/dash
dots 1,4,6   = open bracket (
dots 3,4,5   = close bracket )
blank cell   = space between words

NUMBER INDICATOR MODE (after ⠼ / dots 3,4,5,6):
dots 1       = 1
dots 1,2     = 2
dots 1,4     = 3
dots 1,4,5   = 4
dots 1,5     = 5
dots 1,2,4   = 6
dots 1,2,4,5 = 7
dots 1,2,5   = 8
dots 2,4     = 9
dots 2,4,5   = 0

GRADE 2 / CONTRACTED BRAILLE — COMMON WHOLE-WORD CONTRACTIONS
(entire cell stands for a whole word when preceded/followed by spaces)
dots 1       = "a" (also letter a)
dots 1,2     = "but"
dots 1,4     = "can"
dots 1,4,5   = "do"
dots 1,5     = "every"
dots 1,2,4   = "from"
dots 1,2,4,5 = "go"
dots 1,2,5   = "have"
dots 2,4     = "i" (pronoun)
dots 2,4,5   = "just"
dots 1,3     = "knowledge"
dots 1,2,3   = "like"
dots 1,3,4   = "more"
dots 1,3,4,5 = "not"
dots 1,3,5   = "o"
dots 1,2,3,4 = "people"
dots 1,2,3,4,5 = "quite"
dots 1,2,3,5 = "rather"
dots 2,3,4   = "so"
dots 2,3,4,5 = "that"
dots 1,3,6   = "us"
dots 1,2,3,6 = "very"
dots 2,4,5,6 = "will"
dots 1,3,4,6 = "it"
dots 1,3,4,5,6 = "you"
dots 1,3,5,6 = "as"
dots 3,4,5,6 = "and"
dots 3,4     = "still"
dots 3,4,5   = "for"
dots 2,3     = "his"
dots 2,5,6   = "in"
dots 2,3,5   = "was"
dots 3,6     = "the"

GRADE 2 PART-WORD CONTRACTIONS (common)
dots 2,5      = "dd"
dots 2,5,6    = "en"
dots 1,2,6    = "ff"
dots 1,2,4,6  = "gg"
dots 3,4,5,6  = "and"
dots 1,6      = "ch"
dots 1,4,6    = "gh"
dots 1,2,6    = "sh"
dots 1,4,5,6  = "th"
dots 1,5,6    = "wh"
dots 2,4,6    = "ou"
dots 1,2,4,5,6 = "ow"
dots 3,4,6    = "ing"
dots 4,5,6    = "tion" (and "ness")

NEMETH BRAILLE (math/science) — KEY DIFFERENCES FROM UEB
In Nemeth, dot patterns map differently:
dots 3,4,5,6 = begin Nemeth
dots 3       = , (comma in numbers)
dots 4,6     = . (decimal point)
dots 1,2,3,4,5,6 = (special indicator)
Digits 1-9,0: same as Grade 1 alphabet (a-j) but in lower cell (add dots 3,6 shift)
Actually in Nemeth: digits use LOWER dots:
  dots 2       = 1
  dots 2,3     = 2
  dots 2,5     = 3
  dots 2,5,6   = 4
  dots 2,6     = 5
  dots 2,3,5   = 6
  dots 2,3,5,6 = 7
  dots 2,3,6   = 8
  dots 3,5     = 9
  dots 3,5,6   = 0
Operators in Nemeth:
  dots 3,4     = + (plus)
  dots 3,6     = - (minus)
  dots 1,6     = × (multiply)
  dots 3,4,6   = ÷ (divide)
  dots 4,6     = = (equals) [preceded by dots 1,2,3,4,5,6 sometimes]
  dots 4       = superscript indicator (exponent follows)
  dots 5,6     = subscript indicator

COMPUTER BRAILLE (8-dot ASCII Braille)
Uses all 8 dots (adds dots 7,8 at bottom). Each cell = one ASCII character directly. Common:
  dots 1,2,3,4,5,6,7 = {
  dots 1,2,3,4,5,6,8 = }
  Standard lowercase = same as Grade 1
  Capital = same cell + dot 7

MUSIC BRAILLE
Notes: C D E F G A B = specific cells
  C = dots 1,4,5,6
  D = dots 1,5,6
  E = dots 1,2,4,6
  F = dots 1,2,4,5,6
  G = dots 1,2,5,6
  A = dots 2,4,6
  B = dots 2,4,5,6
Note values (upper 4 dots of cell determine duration):
  Whole = dots 1,3,4,5,6
  Half = dots 1,3,4,6
  Quarter = dots 1,4,5
  Eighth = dots 1,2,4,5
  Sixteenth = dots 1,2,4,5,6
Octave indicators: dots 4 = octave 4 (middle), dots 4,5 = octave 5, etc.
`;

router.post("/braille/process", async (req, res): Promise<void> => {
  const parsed = ProcessBrailleImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { imageBase64, mimeType } = parsed.data;
  const start = Date.now();

  try {
    // Single comprehensive call: inspect dots → classify → decode
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are an expert Braille OCR engine with deep knowledge of all Braille standards. You will be given a Braille reference table and an image. You MUST analyze the actual raised dot patterns you see in the image — do not guess or fabricate text. Only decode what you can actually see.

${BRAILLE_REFERENCE}

CRITICAL RULES:
1. You MUST describe the actual dot patterns you observe in each cell BEFORE decoding. Do not skip this step.
2. If you cannot clearly see the dots in a cell, mark it as [unclear] rather than guessing.
3. Do NOT invent or hallucinate text that isn't in the image.
4. Work left-to-right, top-to-bottom, line by line.
5. Your confidence score must reflect how clearly you can see the dots — poor image quality = lower confidence.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this Braille image carefully using the reference table provided. Follow these steps EXACTLY:

STEP 1 — VISUAL INSPECTION
Describe what you see in the image: image quality, lighting, contrast, how many rows of Braille cells you can identify, approximate number of cells per row.

STEP 2 — DOT PATTERN ANALYSIS  
For each Braille cell (work left to right, row by row), identify which dots (1-6) appear raised. Write it as:
Row 1: [cell1: dots X,X,X] [cell2: dots X,X] [cell3: dots X,X,X,X] ...
Row 2: ...

STEP 3 — SYSTEM CLASSIFICATION
Based on the dot patterns you observed, determine which Braille system this is:
- ueb_grade1: if cells map directly to single letters with no contraction patterns
- ueb_grade2: if you see whole-word contractions (cells like "the", "and", "for" standing alone)
- nemeth: if you see math operators, equation structure, numeric indicator patterns
- computer: if you see 8-dot cells or ASCII-like structure
- music: if you see note/octave indicator patterns
- unknown: if the patterns do not clearly match any system

STEP 4 — DECODING
Using the reference table and your dot observations from Step 2, decode each cell to its character. Show your work:
Row 1: [dots 1,2,5 → h] [dots 1,5 → e] [dots 1,2,3 → l] ...
Assembled row 1: "hel..."

STEP 5 — OUTPUT JSON
Output ONLY a JSON object (no text before or after it):
{
  "rawText": "the fully decoded text, with \\n for line breaks",
  "confidence": 0.85,
  "lineCount": 3,
  "brailleSystem": "ueb_grade2",
  "systemConfidence": 0.9,
  "systemReasoning": "Observed whole-word contraction cells for 'the' (dots 3,6) and 'and' (dots 3,4,5,6). Text uses contracted forms.",
  "regions": [{"x": 5, "y": 10, "width": 90, "height": 80, "confidence": 0.85}],
  "warnings": ["slight blur on right side reduces confidence in last 3 cells"]
}

If you cannot confidently read any Braille (no dots visible, not a Braille image, or very poor quality), output:
{"rawText": "", "confidence": 0.0, "lineCount": 0, "brailleSystem": "unknown", "systemConfidence": 0.0, "systemReasoning": "No readable Braille dots detected", "regions": [], "warnings": ["No Braille content detected in this image"]}`,
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

    const content = response.choices[0]?.message?.content ?? "";

    // Extract the JSON block — it may appear after chain-of-thought reasoning text
    const jsonMatch = content.match(/\{[\s\S]*"rawText"[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.warn({ content: content.slice(0, 500) }, "No JSON found in model response");
      res.status(400).json({ error: "Could not extract Braille decoding result. The image may not contain readable Braille." });
      return;
    }

    let result: {
      rawText?: string;
      confidence?: number;
      lineCount?: number;
      brailleSystem?: string;
      systemConfidence?: number;
      systemReasoning?: string;
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
      brailleSystem: result.brailleSystem ?? "unknown",
      systemConfidence: Math.max(0, Math.min(1, result.systemConfidence ?? 0)),
      systemReasoning: result.systemReasoning ?? "",
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

  const systemInstructions: Record<string, string> = {
    ueb_grade1: `This text was decoded from Grade 1 UEB Braille (letter-by-letter, no contractions). Fix ONLY: missing spaces between words, incorrect capitalization from capital indicators, punctuation from punctuation cells. Do NOT change any words — only fix structural/spacing errors from the OCR process.`,

    ueb_grade2: `This text was decoded from Grade 2 UEB contracted Braille. Check for: unexpanded contractions that should have been expanded (e.g. "⠮" → "the"), missing spaces, capitalization errors. Expand any remaining Braille contractions to full English words. Fix spelling errors that are clearly OCR artifacts. Preserve the original meaning exactly.`,

    nemeth: `This text was decoded from Nemeth mathematical Braille. Your job is to format it cleanly:
- Keep all numbers, operators (+, -, ×, ÷, =, <, >, ≤, ≥), fractions, and exponents exactly as decoded
- Format fractions as "n/d" or "\\frac{n}{d}"
- Format exponents as "x^n"
- Fix only obvious OCR misreads (e.g. "l" vs "1", "O" vs "0")
- Do NOT rewrite or simplify equations`,

    computer: `This text was decoded from Computer Braille (source code / ASCII Braille). PRESERVE EVERYTHING EXACTLY:
- All whitespace, indentation, tabs must be kept
- All special characters (brackets, operators, punctuation) must be kept
- Only fix characters that are clearly OCR artifacts and unambiguously wrong
- This may be source code — syntactic correctness depends on exact characters`,

    music: `This text was decoded from Music Braille. Clean up the output:
- Note names (C, D, E, F, G, A, B) must be correct
- Preserve octave markers (e.g. "4" for middle octave), duration values, dynamics
- Format as: [Note][Octave][Duration] e.g. "C4 quarter, D4 quarter, E4 half"
- Fix only clear misreads`,

    unknown: `This text was decoded from Braille of unidentified type. Apply minimal corrections: fix obvious spacing issues and clear misread characters only. Do not change words or structure.`,
  };

  const instruction = systemInstructions[brailleSystem ?? "unknown"] ?? systemInstructions.unknown;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are a precise Braille OCR post-processor. ${instruction}

Respond ONLY with valid JSON: {"correctedText": "...", "changesApplied": N}
N = number of corrections made. If nothing needed fixing, N = 0 and correctedText = rawText verbatim.`,
        },
        {
          role: "user",
          content: rawText,
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
