import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Volume2,
  Copy,
  Download,
  Check,
  Type,
  Grid3X3,
  FileText,
  Braces,
  Mic,
  MicOff,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   Braille Mapping Engine
   ═══════════════════════════════════════════════════════════════ */

const BRAILLE_MAP: Record<string, string> = {
  A: "⠁", B: "⠃", C: "⠉", D: "⠙", E: "⠑",
  F: "⠋", G: "⠛", H: "⠓", I: "⠊", J: "⠚",
  K: "⠅", L: "⠇", M: "⠍", N: "⠝", O: "⠕",
  P: "⠏", Q: "⠟", R: "⠗", S: "⠎", T: "⠞",
  U: "⠥", V: "⠧", W: "⠺", X: "⠭", Y: "⠽",
  Z: "⠵", " ": "⠀",
  // Numbers (same cell as letters A-J, preceded by number indicator)
  "1": "⠁", "2": "⠃", "3": "⠉", "4": "⠙", "5": "⠑",
  "6": "⠋", "7": "⠛", "8": "⠓", "9": "⠊", "0": "⠚",
  // Punctuation
  ".": "⠲", ",": "⠂", "?": "⠦", "!": "⠖", "'": "⠄",
  "-": "⠤", ":": "⠒", ";": "⠆", "(": "⠐⠣", ")": "⠐⠜",
};

const CAPITAL_PREFIX = "⠠"; // dot 6
const NUMBER_PREFIX = "⠼"; // dots 3,4,5,6

const DOT_PATTERNS: Record<string, number[]> = {
  "⠁": [1], "⠃": [1, 2], "⠉": [1, 4], "⠙": [1, 4, 5], "⠑": [1, 5],
  "⠋": [1, 2, 4], "⠛": [1, 2, 4, 5], "⠓": [1, 2, 5], "⠊": [2, 4], "⠚": [2, 4, 5],
  "⠅": [1, 3], "⠇": [1, 2, 3], "⠍": [1, 3, 4], "⠝": [1, 3, 4, 5], "⠕": [1, 3, 5],
  "⠏": [1, 2, 3, 4], "⠟": [1, 2, 3, 4, 5], "⠗": [1, 2, 3, 5], "⠎": [2, 3, 4], "⠞": [2, 3, 4, 5],
  "⠥": [1, 3, 6], "⠧": [1, 2, 3, 6], "⠺": [2, 4, 5, 6], "⠭": [1, 3, 4, 6], "⠽": [1, 3, 4, 5, 6],
  "⠵": [1, 3, 5, 6],
  "⠠": [6], "⠼": [3, 4, 5, 6],
  "⠲": [2, 5, 6], "⠂": [2], "⠦": [2, 3, 6], "⠖": [2, 3, 5], "⠄": [3],
  "⠤": [3, 6], "⠒": [2, 5], "⠆": [2, 3],
  "⠀": [], // space
};

interface BrailleCell {
  char: string;
  braille: string;
  dots: number[];
}

function textToBraille(text: string): { braille: string; cells: BrailleCell[] } {
  const cells: BrailleCell[] = [];
  let inNumber = false;

  for (const char of text) {
    if (/[0-9]/.test(char)) {
      if (!inNumber) {
        cells.push({ char: "#", braille: NUMBER_PREFIX, dots: DOT_PATTERNS["⠼"] });
        inNumber = true;
      }
      const brailleChar = BRAILLE_MAP[char];
      cells.push({ char, braille: brailleChar, dots: DOT_PATTERNS[brailleChar] || [] });
    } else {
      inNumber = false;
      if (/[A-Z]/.test(char)) {
        cells.push({ char: "⇧", braille: CAPITAL_PREFIX, dots: DOT_PATTERNS["⠠"] });
        const brailleChar = BRAILLE_MAP[char];
        cells.push({ char, braille: brailleChar, dots: DOT_PATTERNS[brailleChar] || [] });
      } else if (/[a-z]/.test(char)) {
        const brailleChar = BRAILLE_MAP[char.toUpperCase()];
        cells.push({ char, braille: brailleChar, dots: DOT_PATTERNS[brailleChar] || [] });
      } else if (char === " ") {
        cells.push({ char: "␣", braille: "⠀", dots: [] });
      } else {
        const brailleChar = BRAILLE_MAP[char];
        if (brailleChar) {
          // handle multi-char braille (parentheses)
          if (brailleChar.length > 1) {
            for (let i = 0; i < brailleChar.length; i++) {
              const subBraille = brailleChar.charAt(i);
              cells.push({
                char: i === 0 ? char : "",
                braille: subBraille,
                dots: DOT_PATTERNS[subBraille] || [],
              });
            }
          } else {
            cells.push({
              char,
              braille: brailleChar,
              dots: DOT_PATTERNS[brailleChar] || [],
            });
          }
        }
      }
    }
  }

  return { braille: cells.map((c) => c.braille).join(""), cells };
}

/* ═══════════════════════════════════════════════════════════════
   Braille Dot Grid — Renders a single 2×3 cell
   Dot layout:  1 4
                2 5
                3 6
   ═══════════════════════════════════════════════════════════════ */

function BrailleDotGrid({
  dots,
  label,
  brailleUnicode,
  index,
}: {
  dots: number[];
  label: string;
  brailleUnicode: string;
  index: number;
}) {
  const dotPositions = [1, 4, 2, 5, 3, 6]; // row-major order for 2×3 grid

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.03, 1.5),
        duration: 0.4,
        type: "spring",
        stiffness: 260,
        damping: 20,
      }}
      className="flex flex-col items-center gap-1.5"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="braille-cell bg-card border border-border"
            aria-label={`Braille cell for character ${label}: ${brailleUnicode}, dots ${dots.join(", ") || "none"}`}
          >
            {dotPositions.map((dotNum) => {
              const isRaised = dots.includes(dotNum);
              return (
                <div
                  key={dotNum}
                  className={`braille-dot ${isRaised ? "raised" : ""}`}
                  aria-hidden="true"
                />
              );
            })}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span className="font-semibold">{label === "␣" ? "Space" : label === "⇧" ? "Capital" : label === "#" ? "Number" : label}</span>
          <span className="ml-2 opacity-70">Dots: {dots.length > 0 ? dots.join("-") : "none"}</span>
        </TooltipContent>
      </Tooltip>
      <span className="text-[10px] font-mono text-muted-foreground leading-none select-none">
        {label}
      </span>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main TextToBraille Component
   ═══════════════════════════════════════════════════════════════ */

export function TextToBraille() {
  const [inputText, setInputText] = useState("");
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const toggleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice Speech Recognition is not supported on this browser. Please try Google Chrome or Safari.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = "en-US";
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(prev => prev + (prev.trim() ? " " : "") + transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  }, [isListening]);

  const { braille, cells } = useMemo(() => {
    if (!inputText.trim()) return { braille: "", cells: [] };
    return textToBraille(inputText);
  }, [inputText]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSpeak = useCallback(() => {
    if (!inputText.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(inputText);
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  }, [inputText]);

  const handleCopy = useCallback(async () => {
    if (!braille) return;
    await navigator.clipboard.writeText(braille);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [braille]);

  const handleDownload = useCallback(
    (format: "txt" | "brf") => {
      if (!braille) return;
      const content =
        format === "brf"
          ? braille
          : `Original: ${inputText}\n\nBraille Unicode:\n${braille}`;
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `braille-output.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [braille, inputText]
  );

  const charCount = inputText.length;
  const cellCount = cells.length;

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="rounded-xl border border-border glass-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-card/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Text Input</h3>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Speech dictation input */}
            <Button
              variant={isListening ? "destructive" : "secondary"}
              size="sm"
              onClick={toggleListening}
              className={`h-8 gap-1.5 px-2.5 text-xs font-bold rounded-lg shrink-0 ${isListening ? 'animate-pulse' : 'bg-secondary border-border text-muted-foreground hover:text-foreground inline-control min-h-0 min-w-0'}`}
              aria-label={isListening ? "Stop listening voice input" : "Dictate text using microphone"}
              aria-live="polite"
            >
              {isListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5 shrink-0 text-white" aria-hidden="true" />
                  <span className="text-[10px] text-white">Listening...</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="text-[10px]">Dictate</span>
                </>
              )}
            </Button>

            <Badge variant="outline" className="text-xs font-mono inline-control min-h-0 min-w-0 border-border text-muted-foreground">
              {charCount} chars
            </Badge>
            <Badge variant="outline" className="text-xs font-mono inline-control min-h-0 min-w-0 border-border text-muted-foreground">
              {cellCount} cells
            </Badge>
          </div>
        </div>
        <div className="p-5">
          <Textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your text here to convert to Braille..."
            className="min-h-[120px] text-base resize-none leading-relaxed bg-card border-border text-foreground placeholder:text-muted-foreground"
            aria-label="Text to convert to Braille"
          />
        </div>
      </div>

      {/* Action Buttons */}
      {inputText.trim() && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-3"
        >
          <Button
            onClick={handleSpeak}
            className="gap-2 gradient-btn"
            aria-label="Read text aloud using speech synthesis"
          >
            <Volume2 className="w-4 h-4" aria-hidden="true" />
            Read Aloud
          </Button>
          <Button
            variant="outline"
            onClick={handleCopy}
            className="gap-2 bg-secondary border-border text-foreground hover:bg-secondary/80"
            aria-label={copied ? "Braille copied to clipboard" : "Copy Braille to clipboard"}
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="w-4 h-4" aria-hidden="true" />
            )}
            {copied ? "Copied!" : "Copy Braille"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDownload("txt")}
            className="gap-2 bg-secondary border-border text-foreground hover:bg-secondary/80"
            aria-label="Download as text file"
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            .txt
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDownload("brf")}
            className="gap-2 bg-secondary border-border text-foreground hover:bg-secondary/80"
            aria-label="Download as BRF file"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            .brf
          </Button>
        </motion.div>
      )}

      {/* Unicode Braille Output */}
      <AnimatePresence>
        {braille && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 22 }}
            className="rounded-xl border border-border glass-card shadow-sm overflow-hidden glow-sm"
          >
            <div className="px-5 py-4 border-b border-border bg-card/60 flex items-center gap-2">
              <Braces className="w-4 h-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">Unicode Braille Output</h3>
            </div>
            <div className="p-5">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="text-2xl md:text-3xl leading-relaxed tracking-wider font-mono break-all select-all text-foreground"
                aria-label="Braille unicode output"
                role="region"
                aria-live="polite"
              >
                {braille}
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Visual Dot Grid */}
      <AnimatePresence>
        {cells.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 22, delay: 0.08 }}
            className="rounded-xl border border-border glass-card shadow-sm overflow-hidden glow-sm"
          >
            <div className="px-5 py-4 border-b border-border bg-card/60 flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">
                Visual Dot Grid
              </h3>
              <span className="text-xs text-muted-foreground ml-1">
                — Hover for details
              </span>
            </div>
            <ScrollArea className="max-h-[60vh]">
              <div className="p-5">
                <div className="flex flex-wrap gap-3 justify-start" role="list" aria-label="Braille dot grid visualization">
                  {cells.map((cell, i) => (
                    <BrailleDotGrid
                      key={`${i}-${cell.char}`}
                      dots={cell.dots}
                      label={cell.char}
                      brailleUnicode={cell.braille}
                      index={i}
                    />
                  ))}
                </div>
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
