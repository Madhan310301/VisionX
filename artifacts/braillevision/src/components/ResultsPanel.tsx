import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Calculator,
  Monitor,
  Music,
  BookOpen,
  BookMarked,
  HelpCircle,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type BrailleSystem = "ueb_grade1" | "ueb_grade2" | "nemeth" | "computer" | "music" | "unknown";

interface ResultsPanelProps {
  rawText: string | null;
  correctedText: string | null;
  confidence: number | null;
  lineCount: number | null;
  warnings: string[];
  brailleSystem?: BrailleSystem | null;
  systemConfidence?: number | null;
  systemReasoning?: string | null;
}

const SYSTEM_META: Record<BrailleSystem, {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  badgeCls: string;
}> = {
  ueb_grade1: {
    label: "English Braille — Grade 1",
    description: "Direct letter-by-letter Braille. One cell per character.",
    icon: BookOpen,
    color: "text-blue-400",
    badgeCls: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  },
  ueb_grade2: {
    label: "English Braille — Grade 2 (Contracted)",
    description: 'Uses contractions like \u201cthe\u201d, \u201cand\u201d, \u201cing\u201d. Most common globally \u2014 USA, UK, Canada, Australia, India.',
    icon: BookMarked,
    color: "text-indigo-400",
    badgeCls: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
  },
  nemeth: {
    label: "Nemeth Code — Mathematical Braille",
    description: "Specialized system for math, equations, scientific notation, and fractions.",
    icon: Calculator,
    color: "text-emerald-400",
    badgeCls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  },
  computer: {
    label: "Computer Braille",
    description: "8-dot system used for source code, programming characters, and technical symbols.",
    icon: Monitor,
    color: "text-violet-400",
    badgeCls: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  },
  music: {
    label: "Music Braille",
    description: "Encodes musical notation including notes, rests, dynamics, and articulation.",
    icon: Music,
    color: "text-rose-400",
    badgeCls: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  },
  unknown: {
    label: "Unknown System",
    description: "Could not confidently classify the Braille system.",
    icon: HelpCircle,
    color: "text-gray-400",
    badgeCls: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  },
};

/* ── SVG Circular Confidence Gauge ────────────────────────── */
const RING_RADIUS = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ConfidenceRing({
  percent,
  strokeColor,
  glowColor,
}: {
  percent: number;
  strokeColor: string;
  glowColor: string;
}) {
  const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;

  return (
    <svg
      className="confidence-ring"
      width="110"
      height="110"
      viewBox="0 0 110 110"
      role="img"
      aria-label={`Confidence gauge: ${percent}%`}
      style={{ filter: `drop-shadow(0 0 12px ${glowColor})` }}
    >
      {/* Background track */}
      <circle
        cx="55"
        cy="55"
        r={RING_RADIUS}
        fill="none"
        stroke="hsl(220 20% 16%)"
        strokeWidth="8"
      />
      {/* Foreground arc */}
      <circle
        className="progress-ring-circle"
        cx="55"
        cy="55"
        r={RING_RADIUS}
        fill="none"
        stroke={strokeColor}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
      />
      {/* Center percentage */}
      <text
        x="55"
        y="55"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground"
        style={{ fontSize: "22px", fontWeight: 700, fontFamily: "var(--app-font-sans)" }}
      >
        {percent}%
      </text>
    </svg>
  );
}

/* ── Stagger animation variants ───────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
  },
};

export function ResultsPanel({
  rawText,
  correctedText,
  confidence,
  lineCount,
  warnings,
  brailleSystem,
  systemConfidence,
  systemReasoning,
}: ResultsPanelProps) {
  const [copiedCorrected, setCopiedCorrected] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  /* ── Empty state ──────────────────────────────────────────── */
  if (!rawText && !correctedText) {
    return (
      <div
        className="h-full min-h-[280px] flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-xl bg-card/40 p-6"
        data-testid="results-empty"
      >
        <div className="glow-sm rounded-full p-3 mb-4">
          <BookOpen className="w-10 h-10 opacity-40 text-primary" aria-hidden="true" />
        </div>
        <p className="font-semibold text-foreground text-base">Awaiting scan results</p>
        <p className="text-sm text-muted-foreground mt-1">Upload an image or use the camera to begin</p>
      </div>
    );
  }

  /* ── Derived values ───────────────────────────────────────── */
  const confidencePercent = confidence !== null ? Math.round(confidence * 100) : 0;
  const systemMeta = brailleSystem ? SYSTEM_META[brailleSystem] : null;
  const SystemIcon = systemMeta?.icon ?? HelpCircle;

  let ringStroke = "hsl(160 60% 45%)"; // emerald
  let ringGlow = "hsla(160,60%,45%,0.45)";
  let ConfidenceIcon = CheckCircle;
  let confidenceClass = "text-emerald-400";
  let confidenceLabel = "High";

  if (confidencePercent < 60) {
    ringStroke = "hsl(0 72% 55%)";
    ringGlow = "hsla(0,72%,55%,0.4)";
    ConfidenceIcon = AlertTriangle;
    confidenceClass = "text-red-400";
    confidenceLabel = "Low";
  } else if (confidencePercent < 85) {
    ringStroke = "hsl(38 92% 55%)";
    ringGlow = "hsla(38,92%,55%,0.4)";
    ConfidenceIcon = AlertCircle;
    confidenceClass = "text-amber-400";
    confidenceLabel = "Medium";
  }

  const handleCopyCorrected = () => {
    if (correctedText) {
      navigator.clipboard.writeText(correctedText);
      setCopiedCorrected(true);
      setTimeout(() => setCopiedCorrected(false), 2000);
    }
  };

  const handleCopyRaw = () => {
    if (rawText) {
      navigator.clipboard.writeText(rawText);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  return (
    <motion.div
      className="space-y-5"
      data-testid="results-panel"
      aria-live="polite"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Braille System Classification Card ────────────────── */}
      {systemMeta && (
        <motion.div
          variants={itemVariants}
          className="glass-card p-4 transition-all"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Detected Braille System
          </p>
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-lg bg-card border border-border shrink-0 ${systemMeta.color}`}>
              <SystemIcon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-sm">{systemMeta.label}</span>
                {systemConfidence != null && (
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold border ${systemMeta.badgeCls}`}
                    data-testid="badge-braille-system"
                  >
                    {Math.round(systemConfidence * 100)}% confidence
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{systemMeta.description}</p>
              {systemReasoning && (
                <div className="bg-muted/30 border border-border/40 p-2.5 rounded-lg text-xs text-muted-foreground/80 mt-2.5 italic leading-relaxed">
                  &ldquo;{systemReasoning}&rdquo;
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Stats row: Circular gauge + Lines ─────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
        {/* Confidence gauge */}
        <div className="glass-card p-4 flex flex-col items-center justify-center text-center transition-all">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 self-start">
            Scan Confidence
          </p>
          <ConfidenceRing percent={confidencePercent} strokeColor={ringStroke} glowColor={ringGlow} />
          <div className="flex items-center gap-1.5 mt-2">
            <ConfidenceIcon className={`w-4 h-4 ${confidenceClass}`} aria-hidden="true" />
            <span className={`text-xs font-semibold ${confidenceClass}`} data-testid="text-confidence">
              {confidenceLabel}
            </span>
          </div>
        </div>

        {/* Lines detected */}
        {lineCount !== null && (
          <div className="glass-card p-4 transition-all">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Lines Detected
            </p>
            <span className="text-2xl font-bold text-foreground" data-testid="text-lines">
              {lineCount}
            </span>
            <div className="text-[10px] text-muted-foreground mt-2 font-mono">COUNT: {lineCount} ROW(S)</div>
          </div>
        )}
      </motion.div>

      {/* ── Warnings ──────────────────────────────────────────── */}
      {warnings && warnings.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2"
          role="alert"
        >
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-400" aria-hidden="true" />
            Scan Warnings
          </div>
          <ul className="list-disc pl-5 text-xs text-amber-300/90 space-y-1">
            {warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* ── Corrected Output — Full Width Primary ─────────────── */}
      <motion.div variants={itemVariants} className="space-y-2 flex flex-col relative group">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Corrected Output
            <span className="bg-emerald-500/15 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
              Final
            </span>
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyCorrected}
            className="w-8 h-8 rounded-lg hover:bg-muted"
            title="Copy corrected text"
            aria-label="Copy corrected text"
          >
            {copiedCorrected ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </Button>
        </div>
        <ScrollArea className="flex-1 glass-card min-h-[180px] h-[300px] transition-all hover:border-primary/20">
          <div
            className="p-5 text-2xl leading-relaxed whitespace-pre-wrap font-serif font-semibold text-foreground"
            data-testid="text-corrected"
          >
            {correctedText}
          </div>
        </ScrollArea>
      </motion.div>

      {/* ── Raw Decoded Braille — Collapsible ─────────────────── */}
      <motion.div variants={itemVariants} className="space-y-2">
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full text-left"
          aria-expanded={showRaw}
          aria-controls="raw-braille-section"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${showRaw ? "rotate-0" : "-rotate-90"}`}
            aria-hidden="true"
          />
          {showRaw ? "Hide" : "Show"} Raw Braille
          <div className="flex-1" />
          {rawText && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyRaw();
              }}
              className="w-8 h-8 rounded-lg hover:bg-muted"
              title="Copy raw braille text"
              aria-label="Copy raw braille text"
            >
              {copiedRaw ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Button>
          )}
        </button>

        <AnimatePresence initial={false}>
          {showRaw && (
            <motion.div
              id="raw-braille-section"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] as const }}
              className="overflow-hidden"
            >
              <ScrollArea className="glass-card min-h-[120px] h-[220px] transition-all hover:border-primary/20">
                <div
                  className="p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground"
                  data-testid="text-raw"
                >
                  {rawText}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
