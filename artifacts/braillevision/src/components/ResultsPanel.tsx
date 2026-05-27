import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

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
    color: "text-blue-600",
    badgeCls: "bg-blue-50 text-blue-700 border-blue-200",
  },
  ueb_grade2: {
    label: "English Braille — Grade 2 (Contracted)",
    description: 'Uses contractions like \u201cthe\u201d, \u201cand\u201d, \u201cing\u201d. Most common globally \u2014 USA, UK, Canada, Australia, India.',
    icon: BookMarked,
    color: "text-indigo-600",
    badgeCls: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  nemeth: {
    label: "Nemeth Code — Mathematical Braille",
    description: "Specialized system for math, equations, scientific notation, and fractions.",
    icon: Calculator,
    color: "text-emerald-600",
    badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  computer: {
    label: "Computer Braille",
    description: "8-dot system used for source code, programming characters, and technical symbols.",
    icon: Monitor,
    color: "text-violet-600",
    badgeCls: "bg-violet-50 text-violet-700 border-violet-200",
  },
  music: {
    label: "Music Braille",
    description: "Encodes musical notation including notes, rests, dynamics, and articulation.",
    icon: Music,
    color: "text-rose-600",
    badgeCls: "bg-rose-50 text-rose-700 border-rose-200",
  },
  unknown: {
    label: "Unknown System",
    description: "Could not confidently classify the Braille system.",
    icon: HelpCircle,
    color: "text-gray-500",
    badgeCls: "bg-gray-100 text-gray-600 border-gray-200",
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
  if (!rawText && !correctedText) {
    return (
      <div
        className="h-full min-h-[280px] flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-xl bg-muted/30 p-6"
        data-testid="results-empty"
      >
        <BookOpen className="w-10 h-10 mb-3 opacity-25" aria-hidden="true" />
        <p className="font-medium text-sm">Awaiting scan results</p>
        <p className="text-xs text-muted-foreground mt-1">Upload an image or use the camera to begin</p>
      </div>
    );
  }

  const confidencePercent = confidence !== null ? Math.round(confidence * 100) : 0;
  const systemMeta = brailleSystem ? SYSTEM_META[brailleSystem] : null;
  const SystemIcon = systemMeta?.icon ?? HelpCircle;

  let confidenceColor = "bg-primary";
  let ConfidenceIcon = CheckCircle;
  let confidenceClass = "text-primary";
  if (confidencePercent < 60) {
    confidenceColor = "bg-destructive";
    ConfidenceIcon = AlertTriangle;
    confidenceClass = "text-destructive";
  } else if (confidencePercent < 85) {
    confidenceColor = "bg-amber-500";
    ConfidenceIcon = AlertCircle;
    confidenceClass = "text-amber-500";
  } else {
    confidenceColor = "bg-emerald-500";
    ConfidenceIcon = CheckCircle;
    confidenceClass = "text-emerald-600";
  }

  return (
    <div className="space-y-5" data-testid="results-panel" aria-live="polite">

      {/* Braille System Classification Card */}
      {systemMeta && (
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Detected Braille System
          </p>
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-lg bg-white border border-border shadow-sm shrink-0 ${systemMeta.color}`}>
              <SystemIcon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-sm">{systemMeta.label}</span>
                {systemConfidence != null && (
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium border ${systemMeta.badgeCls}`}
                    data-testid="badge-braille-system"
                  >
                    {Math.round(systemConfidence * 100)}% confidence
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{systemMeta.description}</p>
              {systemReasoning && (
                <p className="text-xs text-muted-foreground/70 mt-2 italic leading-relaxed">
                  "{systemReasoning}"
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Scan Confidence
          </p>
          <div className="flex items-center gap-2 mb-2">
            <ConfidenceIcon className={`w-4 h-4 ${confidenceClass}`} aria-hidden="true" />
            <span className="text-2xl font-bold text-foreground" data-testid="text-confidence">
              {confidencePercent}%
            </span>
          </div>
          <Progress
            value={confidencePercent}
            className="h-1.5"
            aria-label={`Confidence: ${confidencePercent}%`}
          />
        </div>

        {lineCount !== null && (
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Lines Detected
            </p>
            <span className="text-2xl font-bold text-foreground" data-testid="text-lines">
              {lineCount}
            </span>
          </div>
        )}
      </div>

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            Scan Warnings
          </div>
          <ul className="list-disc pl-5 text-xs text-amber-700 space-y-1">
            {warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Text output */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2 flex flex-col">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Corrected Output
            <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-semibold">Final</span>
          </h3>
          <ScrollArea className="flex-1 border border-border rounded-xl bg-white min-h-[180px] h-[260px] shadow-sm">
            <div
              className="p-4 text-base leading-relaxed whitespace-pre-wrap font-serif text-foreground"
              data-testid="text-corrected"
            >
              {correctedText}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-2 flex flex-col">
          <h3 className="text-sm font-semibold text-foreground">Raw Decoded Braille</h3>
          <ScrollArea className="flex-1 border border-border rounded-xl bg-muted/40 min-h-[180px] h-[260px] shadow-sm">
            <div
              className="p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground"
              data-testid="text-raw"
            >
              {rawText}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
