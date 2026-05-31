/**
 * Braille Rule-Based Corrector (Tier 1)
 * 100% offline, deterministic, instant
 * No external dependencies
 */

export class BrailleRuleCorrector {
  // Grade 2 Braille contractions
  private static CONTRACTIONS: Record<string, string> = {
    "⠮": "the",
    "⠯": "and",
    "⠿": "for",
    "⠬": "ing",
    "⠭": "it",
    "⠽": "you",
    "⠵": "as",
    "⠰⠝": "tion",
    "⠫": "ed",
    "⠩": "ous",
  };

  // Capital indicators
  private static CAPITAL_INDICATOR = "⠠";

  // Number indicator
  private static NUMBER_INDICATOR = "⠼";

  static correct(rawText: string): string {
    let text = rawText;

    // Convert Braille space cell \u2800 (⠀) to standard space immediately
    text = text.replace(/[\u2800⠀]/g, " ");

    // Translate multi-cell punctuation first
    text = text.replace(/⠐⠣/g, "(");
    text = text.replace(/⠐⠜/g, ")");
    text = text.replace(/⠘⠦/g, '"');
    text = text.replace(/⠘⠴/g, '"');

    // Step 1: Fix spacing
    text = this.fixSpacing(text);

    // Step 2: Expand Grade 2 contractions (with optional capital indicators)
    text = this.expandContractions(text);

    // Step 3: Handle capital indicators
    text = this.handleCapitals(text);

    // Step 4: Handle numbers (multi-digit support)
    text = this.handleNumbers(text);

    // Step 5: Translate remaining basic letters to English
    text = this.translateBasicLetters(text);

    // Step 6: Fix punctuation spacing
    text = this.fixPunctuationSpacing(text);

    // Step 7: Math operator spacing
    text = this.fixMathSpacing(text);

    return text;
  }

  private static translateBasicLetters(text: string): string {
    let result = "";
    for (const char of text) {
      if (char >= "⠁" && char <= "⠿") {
        result += this.brailleToEnglish(char);
      } else {
        result += char;
      }
    }
    return result;
  }

  private static fixSpacing(text: string): string {
    // Remove double spaces
    text = text.replace(/\s{2,}/g, " ");

    // Trim leading/trailing
    text = text.trim();

    return text;
  }

  private static expandContractions(text: string): string {
    let result = text;

    // Sort by length descending to handle longer patterns first
    const sorted = Object.entries(this.CONTRACTIONS).sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const [braille, word] of sorted) {
      // Use lookahead and lookbehind to simulate word boundaries for non-ASCII Braille cells,
      // allowing optional single or double capital prefix which is replaced together with the contraction.
      const regex = new RegExp(`(?<=^|\\s|[.,!?;:])(⠠⠠|⠠)?${braille}(?=$|\\s|[.,!?;:])`, "g");
      
      result = result.replace(regex, (match, prefix) => {
        if (prefix === "⠠⠠") {
          return word.toUpperCase();
        } else if (prefix === "⠠") {
          return word.charAt(0).toUpperCase() + word.slice(1);
        } else {
          return word;
        }
      });
    }

    return result;
  }

  private static handleCapitals(text: string): string {
    // 1. Double capital indicator: ⠠⠠ followed by one or more letter cells
    // A letter cell is a Unicode character in the Braille range \u2801 to \u283f, excluding capital (\u2820) and number (\u283c) indicators
    const doubleCapitalRegex = /⠠⠠([\u2801-\u281f\u2821-\u283b\u283d-\u283f]+)/g;
    text = text.replace(doubleCapitalRegex, (match, word) => {
      let result = "";
      for (const char of word) {
        result += this.brailleToEnglish(char);
      }
      return result.toUpperCase();
    });

    // 2. Single capital indicator: ⠠ followed by one letter cell
    const singleCapitalRegex = /⠠([\u2801-\u281f\u2821-\u283b\u283d-\u283f])/g;
    text = text.replace(singleCapitalRegex, (match, char) => {
      return this.brailleToEnglish(char).toUpperCase();
    });

    return text;
  }

  private static handleNumbers(text: string): string {
    // Convert ⠼ followed by any sequence of digits to standard numbers
    // Digits in Braille are cells: ⠁ (1), ⠃ (2), ⠉ (3), ⠙ (4), ⠑ (5), ⠋ (6), ⠛ (7), ⠓ (8), ⠊ (9), ⠚ (0)
    const numberRegex = /⠼([⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚]+)/g;
    return text.replace(numberRegex, (match, digits) => {
      const digitMap: Record<string, string> = {
        "⠁": "1",
        "⠃": "2",
        "⠉": "3",
        "⠙": "4",
        "⠑": "5",
        "⠋": "6",
        "⠛": "7",
        "⠓": "8",
        "⠊": "9",
        "⠚": "0",
      };
      let result = "";
      for (const char of digits) {
        result += digitMap[char] || char;
      }
      return result;
    });
  }

  private static fixPunctuationSpacing(text: string): string {
    // Remove space before punctuation
    text = text.replace(/\s+([.,!?;:])/g, "$1");

    // Add space after punctuation if missing
    text = text.replace(/([.,!?;:])([^ ])/g, "$1 $2");

    return text;
  }

  private static fixMathSpacing(text: string): string {
    // Add spaces around comparison operators
    text = text.replace(/([^=<>])([=<>])([^=<>])/g, "$1 $2 $3");

    return text;
  }

  private static brailleToEnglish(brailleChar: string): string {
    // Comprehensive Braille to English mapping
    const basicMap: Record<string, string> = {
      "⠁": "a",
      "⠃": "b",
      "⠉": "c",
      "⠙": "d",
      "⠑": "e",
      "⠋": "f",
      "⠛": "g",
      "⠓": "h",
      "⠊": "i",
      "⠚": "j",
      "⠅": "k",
      "⠇": "l",
      "⠍": "m",
      "⠝": "n",
      "⠕": "o",
      "⠏": "p",
      "⠟": "q",
      "⠗": "r",
      "⠎": "s",
      "⠞": "t",
      "⠥": "u",
      "⠧": "v",
      "⠺": "w",
      "⠭": "x",
      "⠽": "y",
      "⠵": "z",
      "⠀": " ", // space cell \u2800
      "⠲": ".", // period
      "⠂": ",", // comma
      "⠦": "?", // question mark
      "⠖": "!", // exclamation mark
      "⠄": "'", // apostrophe
      "⠤": "-", // hyphen
      "⠒": ":", // colon
      "⠆": ";", // semicolon
      "⠠": "",  // Capital indicator (safe fallback)
      "⠼": "",  // Number indicator (safe fallback)
    };
    return basicMap[brailleChar] !== undefined ? basicMap[brailleChar] : "?";
  }

  // Calculate confidence score
  static getConfidence(
    rawText: string,
    correctedText: string
  ): number {
    // If no changes, high confidence
    if (rawText === correctedText) return 0.95;

    // Count how many rules matched
    const matchCount = Object.keys(this.CONTRACTIONS).filter(
      (contraction) => rawText.includes(contraction)
    ).length;

    // Confidence increases with matches
    return Math.min(0.95, 0.7 + matchCount * 0.05);
  }
}

// Export for use in routes
export default BrailleRuleCorrector;
