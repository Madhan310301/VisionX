import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ResultsPanelProps {
  rawText: string | null;
  correctedText: string | null;
  confidence: number | null;
  lineCount: number | null;
  warnings: string[];
}

export function ResultsPanel({ rawText, correctedText, confidence, lineCount, warnings }: ResultsPanelProps) {
  if (!rawText && !correctedText) {
    return (
      <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-muted-foreground border border-border rounded-lg bg-card p-6" aria-hidden="true" data-testid="results-empty">
        <p>Awaiting scan results...</p>
      </div>
    );
  }

  const confidencePercent = confidence !== null ? Math.round(confidence * 100) : 0;
  
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
    confidenceClass = "text-emerald-500";
  }

  return (
    <div className="space-y-6" data-testid="results-panel" aria-live="polite">
      {/* Header stats */}
      <div className="flex flex-wrap gap-4 items-center bg-card p-4 rounded-lg border border-border">
        <div className="flex-1 space-y-1">
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Confidence Score</p>
          <div className="flex items-center gap-3">
            <ConfidenceIcon className={`w-5 h-5 ${confidenceClass}`} aria-hidden="true" />
            <span className="text-2xl font-bold" data-testid="text-confidence">{confidencePercent}%</span>
          </div>
          <Progress value={confidencePercent} className={`h-2 [&>div]:${confidenceColor}`} aria-label={`Confidence: ${confidencePercent}%`} />
        </div>
        
        {lineCount !== null && (
          <div className="px-6 border-l border-border space-y-1 hidden sm:block">
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Lines</p>
            <p className="text-2xl font-bold" data-testid="text-lines">{lineCount}</p>
          </div>
        )}
      </div>

      {warnings && warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-500 font-medium">
            <AlertTriangle className="w-5 h-5" />
            <p>Scan Warnings</p>
          </div>
          <ul className="list-disc pl-5 text-sm text-amber-500/90 space-y-1">
            {warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2 flex flex-col">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            Corrected Text
            <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded uppercase tracking-wider font-bold">Final</span>
          </h3>
          <ScrollArea className="flex-1 border border-border rounded-lg bg-card min-h-[200px] h-[300px]">
            <div className="p-4 text-lg leading-relaxed whitespace-pre-wrap font-serif text-foreground" data-testid="text-corrected">
              {correctedText}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-2 flex flex-col">
          <h3 className="text-lg font-semibold text-foreground">Decoded Braille (Raw)</h3>
          <ScrollArea className="flex-1 border border-border rounded-lg bg-muted/50 min-h-[200px] h-[300px]">
            <div className="p-4 text-base leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground" data-testid="text-raw">
              {rawText}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
