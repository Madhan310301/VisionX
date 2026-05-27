import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
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
  Calculator,
  Monitor,
  Music,
  BookOpen,
  BookMarked,
  HelpCircle,
} from "lucide-react";
import {
  useProcessBrailleImage,
  useCorrectBrailleText,
  useSynthesizeSpeech,
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

type Mode = "camera" | "upload" | "video";
type AudioState = "idle" | "loading" | "playing" | "paused";
type Voice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
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

const PIPELINE_STEPS: { id: PipelineStep; label: string }[] = [
  { id: "detecting",   label: "Braille Detection" },
  { id: "classifying", label: "Context Classification" },
  { id: "decoding",    label: "Specialized Decoder" },
  { id: "correcting",  label: "Sentence Reconstruction" },
];

function PipelineIndicator({ step }: { step: PipelineStep }) {
  if (step === "idle" || step === "done") return null;

  const activeIdx = PIPELINE_STEPS.findIndex(s => s.id === step);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="mt-4 rounded-xl border border-border bg-white p-4 shadow-sm"
      role="status"
      aria-live="assertive"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        Processing Pipeline
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        {PIPELINE_STEPS.map((s, i) => {
          const isDone = i < activeIdx;
          const isActive = i === activeIdx;
          return (
            <div key={s.id} className="flex items-center gap-1">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isDone
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isActive && (
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                )}
                {isDone && (
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                )}
                {s.label}
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function Home() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("upload");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [selectedVoice, setSelectedVoice] = useState<Voice>("nova");
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const processMutation = useProcessBrailleImage();
  const correctMutation = useCorrectBrailleText();
  const ttsMutation = useSynthesizeSpeech();
  const createScanMutation = useCreateScan();
  const deleteScanMutation = useDeleteScan();

  const { data: scans, isLoading: scansLoading } = useListScans({ limit: 30 });
  const { data: stats } = useGetScanStats();

  const isProcessing = pipelineStep !== "idle" && pipelineStep !== "done";

  const handleCapture = useCallback(async (dataUrl: string, mimeType: string) => {
    setPipelineStep("detecting");
    setResult(null);
    setSelectedScanId(null);

    try {
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");

      // Step 1+2: vision model detects dots AND classifies system
      setPipelineStep("classifying");
      const processResult = await processMutation.mutateAsync({
        data: { imageBase64: base64, mimeType, mode },
      });

      // Step 3: specialized decode (already done inside process endpoint, display step)
      setPipelineStep("decoding");

      // Step 4: system-aware correction
      setPipelineStep("correcting");
      const correctionResult = await correctMutation.mutateAsync({
        data: {
          rawText: processResult.rawText,
          brailleSystem: processResult.brailleSystem as BrailleSystem,
        },
      });

      const scanResult: ScanResult = {
        rawText: processResult.rawText,
        correctedText: correctionResult.correctedText,
        confidence: processResult.confidence,
        lineCount: processResult.lineCount,
        warnings: processResult.warnings ?? [],
        brailleSystem: (processResult.brailleSystem ?? "unknown") as BrailleSystem,
        systemConfidence: processResult.systemConfidence ?? 0,
        systemReasoning: processResult.systemReasoning ?? "",
      };

      setResult(scanResult);
      setPipelineStep("done");

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
        title: "Scan complete",
        description: `${SYSTEM_LABELS[scanResult.brailleSystem]} detected — ${Math.round(scanResult.confidence * 100)}% confidence`,
      });
    } catch {
      setPipelineStep("idle");
      toast({
        title: "Scan failed",
        description: "Could not process the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      if (pipelineStep !== "idle") setPipelineStep("idle");
    }
  }, [mode, processMutation, correctMutation, createScanMutation, queryClient, toast, pipelineStep]);

  const handleSpeak = useCallback(async () => {
    if (!result?.correctedText) return;

    if (audioState === "playing" && audioRef.current) {
      audioRef.current.pause();
      setAudioState("paused");
      return;
    }
    if (audioState === "paused" && audioRef.current) {
      audioRef.current.play();
      setAudioState("playing");
      return;
    }

    setAudioState("loading");
    try {
      const ttsResult = await ttsMutation.mutateAsync({
        data: { text: result.correctedText, voice: selectedVoice },
      });
      const audio = new Audio(`data:audio/mp3;base64,${ttsResult.audioBase64}`);
      audioRef.current = audio;
      audio.onplay = () => setAudioState("playing");
      audio.onpause = () => setAudioState("paused");
      audio.onended = () => setAudioState("idle");
      audio.onerror = () => {
        setAudioState("idle");
        toast({ title: "Audio error", variant: "destructive" });
      };
      await audio.play();
    } catch {
      setAudioState("idle");
      toast({ title: "Speech synthesis failed", variant: "destructive" });
    }
  }, [audioState, result, selectedVoice, ttsMutation, toast]);

  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setAudioState("idle");
  }, []);

  const handleExport = useCallback((format: "txt" | "json") => {
    if (!result) return;
    let content: string;
    let filename: string;
    let type: string;
    if (format === "txt") {
      content = result.correctedText;
      filename = `braillevision-${Date.now()}.txt`;
      type = "text/plain";
    } else {
      content = JSON.stringify({
        brailleSystem: result.brailleSystem,
        systemConfidence: result.systemConfidence,
        rawText: result.rawText,
        correctedText: result.correctedText,
        confidence: result.confidence,
        lineCount: result.lineCount,
        warnings: result.warnings,
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
  }, [result]);

  const handleDeleteScan = useCallback(async (id: number) => {
    await deleteScanMutation.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListScansQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetScanStatsQueryKey() });
    if (selectedScanId === id) setSelectedScanId(null);
  }, [deleteScanMutation, queryClient, selectedScanId]);

  const selectedScan = scans?.find(s => s.id === selectedScanId);
  const displayResult = selectedScan
    ? {
        rawText: selectedScan.rawText,
        correctedText: selectedScan.correctedText,
        confidence: selectedScan.confidence,
        lineCount: selectedScan.lineCount ?? 0,
        warnings: [],
        brailleSystem: (selectedScan.brailleSystem ?? "unknown") as BrailleSystem,
        systemConfidence: null,
        systemReasoning: null,
      }
    : result
    ? { ...result, systemReasoning: result.systemReasoning ?? null }
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-white sticky top-0 z-10 shadow-sm" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm" aria-hidden="true">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">BrailleVision</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Braille Reading Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {stats && (
              <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground border border-border rounded-lg px-4 py-2 bg-muted/40">
                <div className="flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-foreground" data-testid="stat-total-scans">
                      {stats.totalScans}
                    </span>{" "}
                    scans
                  </span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <span>
                  <span className="font-semibold text-foreground" data-testid="stat-avg-confidence">
                    {Math.round((stats.avgConfidence ?? 0) * 100)}%
                  </span>{" "}
                  avg confidence
                </span>
              </div>
            )}

            <div
              className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border ${
                isProcessing
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
              role="status"
              aria-live="polite"
              aria-label={isProcessing ? "Processing Braille scan" : "System ready"}
            >
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
              )}
              {isProcessing ? "Processing" : "Ready"}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6" role="main">
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          {/* Left column */}
          <div className="space-y-5">
            {/* Input panel */}
            <section
              aria-labelledby="input-section-heading"
              className="rounded-xl border border-border bg-white shadow-sm overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-border bg-muted/30">
                <h2 id="input-section-heading" className="text-sm font-semibold text-foreground">
                  Input Source
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Select your Braille input method</p>
              </div>
              <div className="p-5">
                <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <TabsList className="w-full mb-5" aria-label="Input mode selection">
                    <TabsTrigger value="upload" className="flex-1 gap-2 text-sm" data-testid="tab-upload">
                      <ImageIcon className="w-4 h-4" aria-hidden="true" />
                      Image
                    </TabsTrigger>
                    <TabsTrigger value="camera" className="flex-1 gap-2 text-sm" data-testid="tab-camera">
                      <Camera className="w-4 h-4" aria-hidden="true" />
                      Camera
                    </TabsTrigger>
                    <TabsTrigger value="video" className="flex-1 gap-2 text-sm" data-testid="tab-video">
                      <Film className="w-4 h-4" aria-hidden="true" />
                      Video
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" tabIndex={-1}>
                    <ImageUploadInput onCapture={handleCapture} disabled={isProcessing} />
                  </TabsContent>
                  <TabsContent value="camera" tabIndex={-1}>
                    <CameraInput onCapture={handleCapture} disabled={isProcessing} />
                  </TabsContent>
                  <TabsContent value="video" tabIndex={-1}>
                    <VideoUploadInput onCapture={handleCapture} disabled={isProcessing} />
                  </TabsContent>
                </Tabs>

                <AnimatePresence>
                  <PipelineIndicator step={pipelineStep} />
                </AnimatePresence>
              </div>
            </section>

            {/* Results panel */}
            <section
              aria-labelledby="results-section-heading"
              className="rounded-xl border border-border bg-white shadow-sm overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
                <div>
                  <h2 id="results-section-heading" className="text-sm font-semibold text-foreground">
                    {selectedScan ? "Scan from History" : "Scan Results"}
                  </h2>
                  {selectedScan && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(selectedScan.createdAt).toLocaleString()} — {selectedScan.mode} mode
                    </p>
                  )}
                </div>
                {selectedScan && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedScanId(null)}
                    aria-label="Return to current scan">
                    <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    Current
                  </Button>
                )}
              </div>
              <div className="p-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedScanId ?? "current"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
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
                  </motion.div>
                </AnimatePresence>
              </div>
            </section>

            {/* Speech + Export */}
            {displayResult?.correctedText && (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                aria-labelledby="speech-section-heading"
                className="rounded-xl border border-border bg-white shadow-sm overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-primary" aria-hidden="true" />
                  <h2 id="speech-section-heading" className="text-sm font-semibold text-foreground">
                    Read Aloud
                  </h2>
                </div>
                <div className="p-5 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Button
                      size="default"
                      onClick={handleSpeak}
                      disabled={audioState === "loading"}
                      className="gap-2 min-w-[110px]"
                      aria-label={
                        audioState === "playing" ? "Pause speech"
                        : audioState === "paused" ? "Resume speech"
                        : "Play text as speech"
                      }
                      data-testid="button-play-tts"
                    >
                      {audioState === "loading" ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : audioState === "playing" ? (
                        <Pause className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Play className="w-4 h-4" aria-hidden="true" />
                      )}
                      {audioState === "loading" ? "Loading..." : audioState === "playing" ? "Pause" : audioState === "paused" ? "Resume" : "Play"}
                    </Button>

                    {(audioState === "playing" || audioState === "paused") && (
                      <Button
                        size="default"
                        variant="outline"
                        onClick={handleStop}
                        aria-label="Stop speech playback"
                        data-testid="button-stop-tts"
                      >
                        <Square className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    )}

                    <div className="flex items-center gap-2 ml-1">
                      <label htmlFor="voice-select" className="text-xs text-muted-foreground whitespace-nowrap">
                        Voice
                      </label>
                      <Select
                        value={selectedVoice}
                        onValueChange={(v) => setSelectedVoice(v as Voice)}
                        disabled={audioState === "playing" || audioState === "loading"}
                      >
                        <SelectTrigger id="voice-select" className="w-28 h-9 text-sm"
                          data-testid="select-voice" aria-label="Select voice">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as Voice[]).map(v => (
                            <SelectItem key={v} value={v} className="capitalize text-sm">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleExport("txt")}
                      aria-label="Export as TXT" data-testid="button-export-txt">
                      <Download className="w-4 h-4 mr-1.5" aria-hidden="true" />
                      .txt
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport("json")}
                      aria-label="Export as JSON" data-testid="button-export-json">
                      <Download className="w-4 h-4 mr-1.5" aria-hidden="true" />
                      .json
                    </Button>
                  </div>
                </div>
              </motion.section>
            )}
          </div>

          {/* Right column: History */}
          <aside
            aria-labelledby="history-section-heading"
            className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-6rem)] sticky top-20"
          >
            <div className="px-5 py-4 border-b border-border bg-muted/30 shrink-0">
              <h2 id="history-section-heading" className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
                Scan History
              </h2>
              {stats && (
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                  <span>📷 {stats.byMode?.camera ?? 0}</span>
                  <span>🖼 {stats.byMode?.upload ?? 0}</span>
                  <span>🎬 {stats.byMode?.video ?? 0}</span>
                </div>
              )}
            </div>

            <ScrollArea className="flex-1">
              {scansLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : !scans || scans.length === 0 ? (
                <div className="p-5 flex flex-col items-center justify-center text-center text-muted-foreground py-16">
                  <Camera className="w-10 h-10 mb-3 opacity-20" aria-hidden="true" />
                  <p className="font-medium text-sm">No scans yet</p>
                  <p className="text-xs mt-1">Your scan history will appear here</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  <AnimatePresence>
                    {scans.map((scan) => {
                      const sys = (scan.brailleSystem ?? "unknown") as BrailleSystem;
                      const SysIcon = SYSTEM_ICONS[sys];
                      return (
                        <motion.div
                          key={scan.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          layout
                          className={`rounded-xl border p-3 transition-colors group cursor-pointer ${
                            selectedScanId === scan.id
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:bg-muted/50"
                          }`}
                          data-testid={`card-scan-${scan.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                              onClick={() => setSelectedScanId(scan.id === selectedScanId ? null : scan.id)}
                              aria-label={`View scan from ${new Date(scan.createdAt).toLocaleDateString()}, ${SYSTEM_LABELS[sys]}, confidence ${Math.round(scan.confidence * 100)}%`}
                              aria-pressed={selectedScanId === scan.id}
                            >
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                  <SysIcon className="w-3 h-3" aria-hidden="true" />
                                  <span data-testid={`badge-mode-${scan.id}`}>
                                    {SYSTEM_LABELS[sys]}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs font-bold ml-auto shrink-0 ${
                                    scan.confidence >= 0.85
                                      ? "text-emerald-600"
                                      : scan.confidence >= 0.6
                                      ? "text-amber-600"
                                      : "text-destructive"
                                  }`}
                                  data-testid={`text-confidence-${scan.id}`}
                                >
                                  {Math.round(scan.confidence * 100)}%
                                </span>
                              </div>
                              <p className="text-xs text-foreground truncate leading-relaxed" data-testid={`text-preview-${scan.id}`}>
                                {scan.correctedText.slice(0, 70)}{scan.correctedText.length > 70 ? "…" : ""}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(scan.createdAt).toLocaleString()}
                              </p>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteScan(scan.id); }}
                              className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Delete scan from ${new Date(scan.createdAt).toLocaleDateString()}`}
                              data-testid={`button-delete-${scan.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </aside>
        </div>
      </main>
    </div>
  );
}
