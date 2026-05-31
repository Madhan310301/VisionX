import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import {
  Camera,
  Image as ImageIcon,
  Film,
  Play,
  Pause,
  Square,
  Download,
  Trash2,
  Clock,
  BarChart2,
  Volume2,
  Loader2,
  Eye,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calculator,
  Monitor,
  Music,
  BookOpen,
  BookMarked,
  HelpCircle,
  Accessibility,
  VolumeX,
  Plus,
  Minus,
  Sparkles,
  Zap,
  Scan,
  ArrowRight,
  Sun,
  Moon,
  Shield,
  Keyboard,
} from "lucide-react";
import {
  useProcessBrailleImage,
  useCorrectBrailleText,
  useListScans,
  useCreateScan,
  useDeleteScan,
  useGetScanStats,
  getListScansQueryKey,
  getGetScanStatsQueryKey,
} from "@workspace/api-client-react";
import { CameraInput } from "@/components/CameraInput";
import { ImageUploadInput } from "@/components/ImageUploadInput";
import { VideoUploadInput } from "@/components/VideoUploadInput";
import { ResultsPanel } from "@/components/ResultsPanel";
import { TextToBraille } from "@/components/TextToBraille";
import { RuntimeTelemetry } from "@/components/RuntimeTelemetry";

type Mode = "camera" | "upload" | "video";
type AudioState = "idle" | "loading" | "playing" | "paused";
type BrailleSystem = "ueb_grade1" | "ueb_grade2" | "nemeth" | "computer" | "music" | "unknown";

type PipelineStep =
  | "idle"
  | "detecting"
  | "classifying"
  | "decoding"
  | "correcting"
  | "done";

interface ScanResult {
  rawText: string;
  correctedText: string;
  confidence: number;
  lineCount: number;
  warnings: string[];
  brailleSystem: BrailleSystem;
  systemConfidence: number;
  systemReasoning: string;
  processingMs?: number;
  regions?: Array<{ label?: string; x: number; y: number; width: number; height: number; confidence: number; color?: string }>;
  debugDots?: Array<{ x: number; y: number; radius: number; confidence?: number }>;
  llmEngine?: string | null;
}

const SYSTEM_ICONS: Record<BrailleSystem, React.ElementType> = {
  ueb_grade1: BookOpen,
  ueb_grade2: BookMarked,
  nemeth: Calculator,
  computer: Monitor,
  music: Music,
  unknown: HelpCircle,
};

const SYSTEM_LABELS: Record<BrailleSystem, string> = {
  ueb_grade1: "Grade 1 UEB",
  ueb_grade2: "Grade 2 UEB",
  nemeth: "Nemeth",
  computer: "Computer",
  music: "Music",
  unknown: "Unknown",
};

const PIPELINE_STEPS: { id: PipelineStep; label: string; pct: number }[] = [
  { id: "detecting",   label: "Detecting Braille",     pct: 25 },
  { id: "classifying", label: "Classifying System",    pct: 50 },
  { id: "decoding",    label: "Decoding Cells",        pct: 75 },
  { id: "correcting",  label: "Reconstructing Text",   pct: 100 },
];

/* ─── Full-Width Pipeline Progress Bar ─────────────────────── */
function PipelineProgress({ step }: { step: PipelineStep }) {
  if (step === "idle" || step === "done") return null;

  const activeIdx = PIPELINE_STEPS.findIndex(s => s.id === step);
  const pct = activeIdx >= 0 ? PIPELINE_STEPS[activeIdx].pct : 0;
  const label = activeIdx >= 0 ? PIPELINE_STEPS[activeIdx].label : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mt-5 glass-card p-5"
      role="status"
      aria-live="assertive"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
        <span className="text-xs font-mono font-bold text-primary">{pct}%</span>
      </div>
      <div className="pipeline-bar">
        <div className="pipeline-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {PIPELINE_STEPS.map((s, i) => {
          const isDone = i < activeIdx;
          const isActive = i === activeIdx;
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : isDone
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-muted text-muted-foreground border border-transparent"
                }`}
              >
                {isDone && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
                )}
                {s.label}
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Primary states
  const [mode, setMode] = useState<Mode>("upload");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [processingMs, setProcessingMs] = useState<number | null>(null);

  // SpeechSynthesis states
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [speechVoice, setSpeechVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [spokenCharIndex, setSpokenCharIndex] = useState<number>(-1);
  const rateDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // History + section visibility
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showConverter, setShowConverter] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);

  // Accessibility states
  const [voiceAssist, setVoiceAssist] = useState<boolean>(false);
  const [textScale, setTextScale] = useState<number>(1.0);
  const [scanMode, setScanMode] = useState<string>("auto");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const processMutation = useProcessBrailleImage();
  const correctMutation = useCorrectBrailleText();
  const createScanMutation = useCreateScan();
  const deleteScanMutation = useDeleteScan();

  const { data: scans, isLoading: scansLoading } = useListScans({ limit: 30 });
  const { data: stats } = useGetScanStats();

  const isProcessing = pipelineStep !== "idle" && pipelineStep !== "done";

  const resultsRef = useRef<HTMLDivElement>(null);

  // Load browser voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      
      // Rank voices based on natural quality and English language priority
      const ranked = [...voices].sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        
        const isAEnglish = a.lang.startsWith("en-");
        const isBEnglish = b.lang.startsWith("en-");
        
        if (isAEnglish && !isBEnglish) return -1;
        if (!isAEnglish && isBEnglish) return 1;
        
        const isANatural = aName.includes("natural") || aName.includes("google") || aName.includes("samantha") || aName.includes("premium") || aName.includes("natural");
        const isBNatural = bName.includes("natural") || bName.includes("google") || bName.includes("samantha") || bName.includes("premium") || bName.includes("natural");
        
        if (isANatural && !isBNatural) return -1;
        if (!isANatural && isBNatural) return 1;
        
        return a.name.localeCompare(b.name);
      });

      setAvailableVoices(ranked);
      const englishVoice = ranked.find(v => v.lang.startsWith("en-") && (v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("google")))
        || ranked.find(v => v.lang.startsWith("en-"))
        || ranked[0];
      if (englishVoice) {
        setSpeechVoice(englishVoice);
        setSelectedVoiceName(englishVoice.name);
      }
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Update text scale on body
  useEffect(() => {
    document.body.style.setProperty("--bv-font-scale", textScale.toString());
  }, [textScale]);

  // Sync theme with HTML class
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Voice announcements helper
  const speakAnnouncement = useCallback((text: string) => {
    if (!voiceAssist) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.15;
    window.speechSynthesis.speak(utterance);
  }, [voiceAssist]);

  // Auditory slider rate confirmation
  const speakRatePreview = useCallback((rate: number) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`Speed ${rate.toFixed(1)}`);
    if (speechVoice) utterance.voice = speechVoice;
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }, [speechVoice]);

  // Auto-read result helper
  const autoReadResult = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    setSpokenCharIndex(-1);
    const utterance = new SpeechSynthesisUtterance(text);
    if (speechVoice) utterance.voice = speechVoice;
    utterance.rate = speechRate;
    utterance.onstart = () => setAudioState("playing");
    utterance.onend = () => {
      setAudioState("idle");
      setSpokenCharIndex(-1);
    };
    utterance.onerror = () => {
      setAudioState("idle");
      setSpokenCharIndex(-1);
    };
    utterance.onboundary = (event) => {
      if (event.name === "word") {
        setSpokenCharIndex(event.charIndex);
      }
    };
    window.speechSynthesis.speak(utterance);
  }, [speechVoice, speechRate]);

  // Keyboard accessibility shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        handleSpeak();
      } else if (key === "x") {
        e.preventDefault();
        handleStop();
      } else if (key === "a") {
        e.preventDefault();
        setVoiceAssist(prev => {
          const next = !prev;
          if (next) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance("Voice guidance enabled. Press S to read results, X to stop, A to toggle voice.");
            window.speechSynthesis.speak(u);
          } else {
            window.speechSynthesis.cancel();
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [voiceAssist, result, audioState, speakAnnouncement]);

  const handleCapture = useCallback(async (dataUrl: string, mimeType: string) => {
    setPipelineStep("detecting");
    setResult(null);
    setSelectedScanId(null);
    const startTime = Date.now();

    speakAnnouncement("Braille image received. Starting analysis.");

    try {
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");

      setPipelineStep("classifying");
      speakAnnouncement("Classifying braille system.");
      const processResult = await processMutation.mutateAsync({
        data: { imageBase64: base64, mimeType, mode, scanMode },
      });

      setPipelineStep("decoding");
      speakAnnouncement("Decoding braille cells.");

      setPipelineStep("correcting");
      speakAnnouncement("Reconstructing text.");
      const correctionResult = await correctMutation.mutateAsync({
        data: {
          rawText: processResult.rawText,
          brailleSystem: processResult.brailleSystem as BrailleSystem,
        },
      });

      const totalTime = Date.now() - startTime;
      setProcessingMs(totalTime);

      const scanResult: ScanResult = {
        rawText: processResult.rawText,
        correctedText: correctionResult.correctedText,
        confidence: processResult.confidence,
        lineCount: processResult.lineCount,
        warnings: processResult.warnings ?? [],
        brailleSystem: (processResult.brailleSystem && SYSTEM_LABELS[processResult.brailleSystem as BrailleSystem] ? processResult.brailleSystem : "unknown") as BrailleSystem,
        systemConfidence: processResult.systemConfidence ?? 0,
        systemReasoning: processResult.systemReasoning ?? "",
        processingMs: totalTime,
        regions: processResult.regions ?? [],
        debugDots: processResult.debugDots ?? [],
        llmEngine: (correctionResult as any).llmEngine ?? "local-rules",
      };

      setResult(scanResult);
      setPipelineStep("done");

      // Auto-read the result aloud
      if (voiceAssist && correctionResult.correctedText) {
        setTimeout(() => {
          autoReadResult(`Scan complete. ${SYSTEM_LABELS[scanResult.brailleSystem]} detected with ${Math.round(scanResult.confidence * 100)} percent confidence. The text reads: ${correctionResult.correctedText}`);
        }, 300);
      }

      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);

      await createScanMutation.mutateAsync({
        data: {
          mode,
          rawText: scanResult.rawText,
          correctedText: scanResult.correctedText,
          confidence: scanResult.confidence,
          lineCount: scanResult.lineCount,
          brailleSystem: scanResult.brailleSystem,
        },
      });

      queryClient.invalidateQueries({ queryKey: getListScansQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetScanStatsQueryKey() });

      toast({
        title: "✅ Scan complete",
        description: `${SYSTEM_LABELS[scanResult.brailleSystem]} — ${Math.round(scanResult.confidence * 100)}% confidence`,
      });
    } catch {
      setPipelineStep("idle");
      speakAnnouncement("Scan failed. Please try a clearer image.");
      toast({
        title: "Scan failed",
        description: "Could not process the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPipelineStep("idle");
    }
  }, [mode, scanMode, processMutation, correctMutation, createScanMutation, queryClient, toast, speakAnnouncement, voiceAssist, autoReadResult]);

  const selectedScan = scans?.find(s => s.id === selectedScanId);
  const displayResult = selectedScan
    ? {
        rawText: selectedScan.rawText,
        correctedText: selectedScan.correctedText,
        confidence: selectedScan.confidence,
        lineCount: selectedScan.lineCount ?? 0,
        warnings: [] as string[],
        brailleSystem: (selectedScan.brailleSystem ?? "unknown") as BrailleSystem,
        systemConfidence: null,
        systemReasoning: null,
        processingMs: 140,
        regions: [] as any[],
        debugDots: [] as any[],
        llmEngine: "local-rules" as string | null,
      }
    : result
    ? { ...result, systemReasoning: result.systemReasoning ?? null }
    : null;

  const words = useMemo(() => {
    if (!displayResult?.correctedText) return [];
    const text = displayResult.correctedText;
    const splitWords = text.split(/(\s+)/);
    let currentIndex = 0;
    return splitWords.map((word) => {
      const start = currentIndex;
      const end = currentIndex + word.length;
      currentIndex = end;
      return {
        text: word,
        start,
        end,
        isWord: /\S/.test(word)
      };
    });
  }, [displayResult?.correctedText]);

  // Browser-based SpeechSynthesis functions
  const handleSpeak = useCallback(() => {
    if (!displayResult?.correctedText) return;
    if (audioState === "playing") {
      window.speechSynthesis.pause();
      setAudioState("paused");
      return;
    }
    if (audioState === "paused") {
      window.speechSynthesis.resume();
      setAudioState("playing");
      return;
    }
    setAudioState("loading");
    window.speechSynthesis.cancel();
    setSpokenCharIndex(-1);
    try {
      const utterance = new SpeechSynthesisUtterance(displayResult.correctedText);
      if (speechVoice) utterance.voice = speechVoice;
      utterance.rate = speechRate;
      utterance.onstart = () => setAudioState("playing");
      utterance.onend = () => {
        setAudioState("idle");
        setSpokenCharIndex(-1);
      };
      utterance.onerror = () => {
        setAudioState("idle");
        setSpokenCharIndex(-1);
      };
      utterance.onboundary = (event) => {
        if (event.name === "word") {
          setSpokenCharIndex(event.charIndex);
        }
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      setAudioState("idle");
      setSpokenCharIndex(-1);
      toast({ title: "Speech failed", description: "Browser SpeechSynthesis error.", variant: "destructive" });
    }
  }, [audioState, displayResult, speechVoice, speechRate, toast]);

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    setAudioState("idle");
    setSpokenCharIndex(-1);
  }, []);

  const handleVoiceSelect = (voiceName: string) => {
    setSelectedVoiceName(voiceName);
    const voice = availableVoices.find(v => v.name === voiceName);
    if (voice) setSpeechVoice(voice);
  };

  const handleExport = useCallback((format: "txt" | "json") => {
    if (!displayResult) return;
    let content: string;
    let filename: string;
    let type: string;
    if (format === "txt") {
      content = displayResult.correctedText;
      filename = `braillevision-${Date.now()}.txt`;
      type = "text/plain";
    } else {
      content = JSON.stringify({
        brailleSystem: displayResult.brailleSystem,
        rawText: displayResult.rawText,
        correctedText: displayResult.correctedText,
        confidence: displayResult.confidence,
        lineCount: displayResult.lineCount,
        exportedAt: new Date().toISOString(),
      }, null, 2);
      filename = `braillevision-${Date.now()}.json`;
      type = "application/json";
    }
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [displayResult]);

  const handleDeleteScan = useCallback(async (id: number) => {
    await deleteScanMutation.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListScansQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetScanStatsQueryKey() });
    if (selectedScanId === id) setSelectedScanId(null);
  }, [deleteScanMutation, queryClient, selectedScanId]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-all relative">
      {/* Ambient background orbs */}
      <div className="ambient-orb" style={{ width: 400, height: 400, top: -100, left: -100, background: 'hsl(199 89% 48% / 0.06)' }} />
      <div className="ambient-orb" style={{ width: 300, height: 300, top: '40%', right: -80, background: 'hsl(270 70% 60% / 0.04)', animationDelay: '4s' }} />
      <div className="ambient-orb" style={{ width: 250, height: 250, bottom: -50, left: '30%', background: 'hsl(160 60% 45% / 0.04)', animationDelay: '8s' }} />

      {/* ─── Header ─────────────────────────────────────────── */}
      <header className="glass-header sticky top-0 z-20" role="banner">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0 shadow-lg glow-sm">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                BrailleVision
                <Badge variant="outline" className="bg-primary/10 text-primary text-[10px] font-bold border-primary/20 shrink-0 badge-inline">
                  AI
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Braille Recognition • Powered by Neural Vision</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Text Scale */}
            <div className="flex items-center border border-border bg-secondary/50 rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-primary/10 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setTextScale(s => Math.max(0.85, +(s - 0.15).toFixed(2)));
                  speakAnnouncement("Font size decreased");
                }}
                title="Decrease Text Size"
                aria-label="Decrease text size"
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[11px] font-bold px-2 font-mono text-muted-foreground" aria-live="polite">
                {Math.round(textScale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-primary/10 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setTextScale(s => Math.min(1.45, +(s + 0.15).toFixed(2)));
                  speakAnnouncement("Font size increased");
                }}
                title="Increase Text Size"
                aria-label="Increase text size"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Voice Assist Toggle */}
            <Button
              variant={voiceAssist ? "default" : "outline"}
              onClick={() => {
                const next = !voiceAssist;
                setVoiceAssist(next);
                if (next) {
                  window.speechSynthesis.cancel();
                  const u = new SpeechSynthesisUtterance("Voice assist enabled.");
                  window.speechSynthesis.speak(u);
                } else {
                  window.speechSynthesis.cancel();
                }
              }}
              className={`gap-2 h-10 text-xs font-bold shrink-0 ${voiceAssist ? 'glow-sm' : 'border-border'}`}
              aria-label="Toggle voice guidance"
            >
              {voiceAssist ? (
                <>
                  <Accessibility className="w-4 h-4" />
                  <span className="hidden sm:inline">Voice ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                  <span className="hidden sm:inline">Voice OFF</span>
                </>
              )}
            </Button>

            {/* Theme Toggle */}
            <Button
              variant="outline"
              size="icon"
              className="w-10 h-10 border-border hover:bg-primary/10 hover:text-foreground shrink-0 rounded-xl"
              onClick={() => {
                const nextTheme = theme === "dark" ? "light" : "dark";
                setTheme(nextTheme);
                // Also give a high-priority voice confirmation
                window.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(`${nextTheme === "dark" ? "Dark" : "Light"} theme active.`);
                window.speechSynthesis.speak(u);
              }}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ───────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 relative z-10" role="main">

        {/* ═══ HERO SECTION ═══════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 hero-bg py-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Braille Recognition
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
            <span className="gradient-text">See Braille.</span>{" "}
            <span className="text-foreground">Hear Words.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Upload or capture Braille text and instantly decode it using neural vision.
            Built for <strong className="text-foreground">accessibility</strong> — results are read aloud automatically.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6 text-xs font-semibold text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              5 Braille Systems
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Real-Time Processing
            </div>
            <div className="flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-primary" />
              Full Keyboard Nav
            </div>
          </div>
        </motion.section>

        {/* ═══ SCAN INPUT SECTION ═════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          aria-labelledby="input-source-header"
          className="glass-card overflow-hidden mb-6"
        >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Scan className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 id="input-source-header" className="text-sm font-bold text-foreground">Scan Braille</h2>
                <p className="text-xs text-muted-foreground">Upload an image, use your camera, or provide a video</p>
              </div>
            </div>
            {/* Scan Mode Selector */}
            <div className="hidden sm:block">
              <Select value={scanMode} onValueChange={(val) => {
                setScanMode(val);
                speakAnnouncement(`Scan mode: ${val === "auto" ? "Auto-detect" : val === "az" ? "A-Z Card" : val === "scio" ? "sciobraill Card" : "Standard OCR"}`);
              }}>
                <SelectTrigger className="w-64 font-semibold bg-secondary/50 border-border text-sm h-9">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">🤖 Auto-Detect (Recommended)</SelectItem>
                  <SelectItem value="az">🔠 A-Z Alphabet Card</SelectItem>
                  <SelectItem value="scio">🏷️ sciobraill Card</SelectItem>
                  <SelectItem value="standard">⚡ Standard Neural OCR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-6">
            {/* Mobile scan mode */}
            <div className="sm:hidden mb-4">
              <Select value={scanMode} onValueChange={setScanMode}>
                <SelectTrigger className="w-full font-semibold bg-secondary/50 border-border text-sm">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">🤖 Auto-Detect</SelectItem>
                  <SelectItem value="az">🔠 A-Z Alphabet Card</SelectItem>
                  <SelectItem value="scio">🏷️ sciobraill Card</SelectItem>
                  <SelectItem value="standard">⚡ Standard Neural OCR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs value={mode} onValueChange={(val) => {
              setMode(val as Mode);
              speakAnnouncement(`Input: ${val}`);
            }}>
              <TabsList className="w-full mb-5 bg-secondary/30 border border-border" aria-label="Input mode">
                <TabsTrigger value="upload" className="flex-1 gap-2 text-xs font-bold data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Image
                </TabsTrigger>
                <TabsTrigger value="camera" className="flex-1 gap-2 text-xs font-bold data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <Camera className="w-3.5 h-3.5" />
                  Camera
                </TabsTrigger>
                <TabsTrigger value="video" className="flex-1 gap-2 text-xs font-bold data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <Film className="w-3.5 h-3.5" />
                  Video
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" tabIndex={-1}>
                <ImageUploadInput onCapture={handleCapture} disabled={isProcessing} dots={displayResult?.debugDots} />
              </TabsContent>
              <TabsContent value="camera" tabIndex={-1}>
                <CameraInput onCapture={handleCapture} disabled={isProcessing} dots={displayResult?.debugDots} />
              </TabsContent>
              <TabsContent value="video" tabIndex={-1}>
                <VideoUploadInput onCapture={handleCapture} disabled={isProcessing} />
              </TabsContent>
            </Tabs>

            <AnimatePresence>
              <PipelineProgress step={pipelineStep} />
            </AnimatePresence>
          </div>
        </motion.section>

        {/* ═══ RESULTS SECTION ════════════════════════════════ */}
        <div ref={resultsRef}>
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            aria-labelledby="results-header"
            className="glass-card overflow-hidden mb-6"
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 id="results-header" className="text-sm font-bold text-foreground">
                    {selectedScan ? "History Record" : "Decoded Output"}
                  </h2>
                  {selectedScan && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(selectedScan.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              {selectedScan && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedScanId(null)}
                  className="text-primary hover:bg-primary/10"
                  aria-label="Return to current scan"
                >
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Current Scan
                </Button>
              )}
            </div>
            <div className="p-6">
              <ResultsPanel
                rawText={displayResult?.rawText ?? null}
                correctedText={displayResult?.correctedText ?? null}
                confidence={displayResult?.confidence ?? null}
                lineCount={displayResult?.lineCount ?? null}
                warnings={displayResult?.warnings ?? []}
                brailleSystem={displayResult?.brailleSystem ?? null}
                systemConfidence={displayResult?.systemConfidence ?? null}
                systemReasoning={displayResult?.systemReasoning ?? null}
              />
            </div>
          </motion.section>
        </div>

        {/* ═══ VOICE READER (shows when results exist) ═══════ */}
        <AnimatePresence>
          {displayResult?.correctedText && (
            <motion.section
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              aria-labelledby="audio-reader-header"
              className="glass-card overflow-hidden mb-6 p-6"
            >
              <div className="flex items-center gap-2 mb-4 border-b border-border pb-3">
                <Volume2 className="w-5 h-5 text-primary" />
                <h2 id="audio-reader-header" className="text-sm font-bold text-foreground">Voice Reader</h2>
              </div>

              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={handleSpeak}
                    disabled={audioState === "loading"}
                    className="gradient-btn font-bold min-w-32.5 h-11 rounded-xl flex items-center justify-center gap-2"
                    aria-label={
                      audioState === "playing" ? "Pause speech"
                      : audioState === "paused" ? "Resume speech"
                      : "Start reading aloud"
                    }
                  >
                    {audioState === "loading" ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : audioState === "playing" ? (
                      <Pause className="w-4 h-4 shrink-0" />
                    ) : (
                      <Play className="w-4 h-4 shrink-0" />
                    )}
                    {audioState === "loading" ? "Loading..." : audioState === "playing" ? "Pause [S]" : audioState === "paused" ? "Resume [S]" : "Read Aloud [S]"}
                  </Button>

                  {/* Equalizer wave visualization */}
                  {audioState === "playing" && (
                    <div className="flex items-end gap-1 h-5 px-3 bg-secondary/30 rounded-lg border border-border" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((bar) => (
                        <motion.div
                          key={bar}
                          animate={{
                            height: ["4px", "16px", "4px"],
                          }}
                          transition={{
                            duration: 0.45 + bar * 0.08,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="w-1 bg-primary rounded-full"
                        />
                      ))}
                    </div>
                  )}

                  {(audioState === "playing" || audioState === "paused") && (
                    <Button
                      variant="outline"
                      onClick={handleStop}
                      className="font-semibold border-border hover:text-destructive hover:border-destructive/30 rounded-xl"
                      aria-label="Stop audio"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Stop [X]
                    </Button>
                  )}

                  {/* Speed control */}
                  <div className="flex items-center gap-2 border border-border p-2 rounded-lg bg-secondary/30">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      {speechRate}x
                    </span>
                    <div className="w-20">
                      <Slider
                        value={[speechRate]}
                        min={0.6}
                        max={2.0}
                        step={0.1}
                        onValueChange={(val) => {
                          const rateVal = val[0];
                          setSpeechRate(rateVal);
                          if (rateDebounceRef.current) clearTimeout(rateDebounceRef.current);
                          rateDebounceRef.current = setTimeout(() => {
                            speakRatePreview(rateVal);
                          }, 350);
                        }}
                        aria-label="Speech speed"
                      />
                    </div>
                  </div>

                  {/* Voice selector */}
                  {availableVoices.length > 0 && (
                    <Select
                      value={selectedVoiceName}
                      onValueChange={handleVoiceSelect}
                      disabled={audioState === "playing"}
                    >
                      <SelectTrigger className="w-40 h-9 text-xs font-semibold bg-secondary/30 border-border rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVoices.slice(0, 30).map(v => (
                          <SelectItem key={v.name} value={v.name} className="text-xs">
                            {v.name.slice(0, 22)} ({v.lang})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Export */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("txt")}
                    className="text-xs font-semibold border-border hover:bg-primary/10 hover:text-primary rounded-lg"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    .txt
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("json")}
                    className="text-xs font-semibold border-border hover:bg-primary/10 hover:text-primary rounded-lg"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    .json
                  </Button>
                </div>
              </div>

              {/* Interactive split-word highlighting box */}
              {words.length > 0 && (
                <div className="mt-4 p-5 rounded-xl border border-primary/15 bg-card/60 shadow-inner max-h-40 overflow-y-auto leading-relaxed text-lg tracking-wide select-none">
                  {words.map((w, idx) => {
                    const isActive = spokenCharIndex >= w.start && spokenCharIndex < w.end && w.isWord;
                    return (
                      <span
                        key={idx}
                        className={`transition-all duration-150 rounded-sm px-0.5 ${
                          isActive
                            ? "bg-primary/20 text-primary border-b-2 border-primary font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                            : "text-foreground/80"
                        }`}
                      >
                        {w.text}
                      </span>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* ═══ COLLAPSIBLE SECTIONS ═══════════════════════════ */}

        {/* Text-to-Braille Converter */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-card overflow-hidden mb-6"
        >
          <button
            onClick={() => setShowConverter(!showConverter)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-secondary/20 transition-colors text-left"
            aria-expanded={showConverter}
            aria-controls="converter-content"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Text → Braille Converter</h2>
                <p className="text-xs text-muted-foreground">Type text and see it converted to visual Braille cells</p>
              </div>
            </div>
            {showConverter ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {showConverter && (
              <motion.div
                id="converter-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 border-t border-border pt-4">
                  <TextToBraille />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Telemetry Panel */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="glass-card overflow-hidden mb-6"
        >
          <button
            onClick={() => setShowTelemetry(!showTelemetry)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-secondary/20 transition-colors text-left"
            aria-expanded={showTelemetry}
            aria-controls="telemetry-content"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <BarChart2 className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Pipeline Telemetry</h2>
                <p className="text-xs text-muted-foreground">CV pipeline breakdown and dot detection summary</p>
              </div>
            </div>
            {showTelemetry ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {showTelemetry && (
              <motion.div
                id="telemetry-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 border-t border-border pt-4">
                  <RuntimeTelemetry
                    isProcessing={isProcessing}
                    processingMs={displayResult?.processingMs ?? processingMs}
                    confidence={displayResult?.confidence ?? null}
                    lineCount={displayResult?.lineCount ?? null}
                    brailleSystem={displayResult?.brailleSystem ?? null}
                    llmEngine={displayResult?.llmEngine ?? null}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Scan History */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="glass-card overflow-hidden mb-6"
        >
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-secondary/20 transition-colors text-left"
            aria-expanded={showHistory}
            aria-controls="history-content"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Scan History</h2>
                <p className="text-xs text-muted-foreground">
                  {stats ? `${(stats.byMode?.camera ?? 0) + (stats.byMode?.upload ?? 0)} total scans` : "View past scan records"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {scans && scans.length > 0 && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs badge-inline">
                  {scans.length}
                </Badge>
              )}
              {showHistory ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </div>
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                id="history-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border">
                  <ScrollArea className="max-h-100">
                    {scansLoading ? (
                      <div className="p-4 space-y-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                        ))}
                      </div>
                    ) : !scans || scans.length === 0 ? (
                      <div className="p-6 flex flex-col items-center justify-center text-center text-muted-foreground py-12">
                        <Camera className="w-8 h-8 mb-2.5 opacity-20 text-primary" />
                        <p className="font-semibold text-foreground text-sm">No history</p>
                        <p className="text-xs mt-1">Scans will appear here</p>
                      </div>
                    ) : (
                      <div className="p-3 space-y-2">
                        {scans.map((scan) => {
                          const rawSys = scan.brailleSystem as BrailleSystem;
                          const sys = (rawSys && SYSTEM_ICONS[rawSys] ? rawSys : "unknown") as BrailleSystem;
                          const SysIcon = SYSTEM_ICONS[sys] || HelpCircle;
                          return (
                            <motion.div
                              key={scan.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className={`rounded-xl border p-3 transition-all cursor-pointer flex justify-between gap-3 group relative hover:glow-sm ${
                                selectedScanId === scan.id
                                  ? "border-primary/40 bg-primary/5"
                                  : "border-border bg-secondary/20 hover:bg-secondary/40"
                              }`}
                              onClick={() => {
                                setSelectedScanId(scan.id === selectedScanId ? null : scan.id);
                                speakAnnouncement(`Viewing scan from ${new Date(scan.createdAt).toLocaleDateString()}`);
                              }}
                              data-testid={`card-scan-${scan.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                  <SysIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                                  <span className="text-xs font-bold text-foreground">{SYSTEM_LABELS[sys]}</span>
                                  <span
                                    className={`text-xs font-extrabold ml-auto ${
                                      scan.confidence >= 0.85 ? "text-emerald-400"
                                      : scan.confidence >= 0.6 ? "text-amber-400"
                                      : "text-destructive"
                                    }`}
                                  >
                                    {Math.round(scan.confidence * 100)}%
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                  {scan.correctedText}
                                </p>
                                <span className="text-[9px] text-muted-foreground/50 font-mono mt-1 block">
                                  {new Date(scan.createdAt).toLocaleDateString()} at {new Date(scan.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteScan(scan.id);
                                }}
                                className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 self-center"
                                aria-label={`Delete scan from ${new Date(scan.createdAt).toLocaleDateString()}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ═══ KEYBOARD SHORTCUTS HINT ════════════════════════ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center pb-8 text-xs text-muted-foreground/50 font-mono"
        >
          <span className="inline-flex items-center gap-4">
            <span><kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px]">S</kbd> Read Aloud</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px]">X</kbd> Stop</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px]">A</kbd> Voice Assist</span>
          </span>
        </motion.div>
      </main>
    </div>
  );
}
