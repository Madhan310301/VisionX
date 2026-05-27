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

interface ScanResult {
  rawText: string;
  correctedText: string;
  confidence: number;
  lineCount: number;
  warnings: string[];
}

export default function Home() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("upload");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const handleCapture = useCallback(async (dataUrl: string, mimeType: string) => {
    setIsProcessing(true);
    setResult(null);

    try {
      // Strip the data URL prefix to get raw base64
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");

      const processResult = await processMutation.mutateAsync({
        data: { imageBase64: base64, mimeType, mode },
      });

      const correctionResult = await correctMutation.mutateAsync({
        data: { rawText: processResult.rawText },
      });

      const scanResult: ScanResult = {
        rawText: processResult.rawText,
        correctedText: correctionResult.correctedText,
        confidence: processResult.confidence,
        lineCount: processResult.lineCount,
        warnings: processResult.warnings ?? [],
      };

      setResult(scanResult);

      // Save to history
      await createScanMutation.mutateAsync({
        data: {
          mode,
          rawText: scanResult.rawText,
          correctedText: scanResult.correctedText,
          confidence: scanResult.confidence,
          lineCount: scanResult.lineCount,
        },
      });

      queryClient.invalidateQueries({ queryKey: getListScansQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetScanStatsQueryKey() });

      toast({ title: "Scan complete", description: `Confidence: ${Math.round(scanResult.confidence * 100)}%` });
    } catch (err) {
      toast({ title: "Scan failed", description: "Could not process the image. Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [mode, processMutation, correctMutation, createScanMutation, queryClient, toast]);

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
      audio.onerror = () => { setAudioState("idle"); toast({ title: "Audio error", variant: "destructive" }); };

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
      filename = `braillevision-scan-${Date.now()}.txt`;
      type = "text/plain";
    } else {
      content = JSON.stringify({
        rawText: result.rawText,
        correctedText: result.correctedText,
        confidence: result.confidence,
        lineCount: result.lineCount,
        warnings: result.warnings,
        exportedAt: new Date().toISOString(),
      }, null, 2);
      filename = `braillevision-scan-${Date.now()}.json`;
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
      }
    : result;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0" aria-hidden="true">
              <Eye className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">BrailleVision</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Braille Reading Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats bar */}
            {stats && (
              <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground border border-border rounded-lg px-4 py-2 bg-card">
                <div className="flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span data-testid="stat-total-scans"><span className="font-semibold text-foreground">{stats.totalScans}</span> scans</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div>
                  <span className="font-semibold text-foreground" data-testid="stat-avg-confidence">{Math.round((stats.avgConfidence ?? 0) * 100)}%</span>
                  <span className="ml-1">avg confidence</span>
                </div>
              </div>
            )}

            <div
              className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border ${
                isProcessing
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              }`}
              role="status"
              aria-live="polite"
              aria-label={isProcessing ? "Processing Braille scan" : "System ready"}
              data-testid="status-indicator"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
              )}
              {isProcessing ? "Processing" : "Ready"}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6" role="main">
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          {/* Left column: Input + Results */}
          <div className="space-y-6">
            {/* Input panel */}
            <section aria-labelledby="input-section-heading" className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 id="input-section-heading" className="text-base font-semibold text-foreground">Input Source</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Select your Braille input method</p>
              </div>

              <div className="p-5">
                <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <TabsList className="w-full mb-5" aria-label="Input mode selection">
                    <TabsTrigger value="upload" className="flex-1 gap-2" data-testid="tab-upload">
                      <ImageIcon className="w-4 h-4" aria-hidden="true" />
                      Image
                    </TabsTrigger>
                    <TabsTrigger value="camera" className="flex-1 gap-2" data-testid="tab-camera">
                      <Camera className="w-4 h-4" aria-hidden="true" />
                      Camera
                    </TabsTrigger>
                    <TabsTrigger value="video" className="flex-1 gap-2" data-testid="tab-video">
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

                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg"
                    role="status"
                    aria-live="assertive"
                  >
                    <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Analyzing Braille content...</p>
                      <p className="text-xs text-muted-foreground">Detecting dots, reconstructing reading order, and decoding text</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </section>

            {/* Results panel */}
            <section aria-labelledby="results-section-heading" className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 id="results-section-heading" className="text-base font-semibold text-foreground">
                    {selectedScan ? "Scan from History" : "Scan Results"}
                  </h2>
                  {selectedScan && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(selectedScan.createdAt).toLocaleString()} — {selectedScan.mode} mode
                    </p>
                  )}
                </div>
                {selectedScan && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedScanId(null)}
                    aria-label="Return to current scan"
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    Current scan
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
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </section>

            {/* Speech + Export controls */}
            {displayResult?.correctedText && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                aria-labelledby="speech-section-heading"
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-border">
                  <h2 id="speech-section-heading" className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-primary" aria-hidden="true" />
                    Read Aloud
                  </h2>
                </div>
                <div className="p-5 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Button
                      size="lg"
                      onClick={handleSpeak}
                      disabled={audioState === "loading"}
                      className="gap-2 min-w-[120px]"
                      aria-label={audioState === "playing" ? "Pause speech" : audioState === "paused" ? "Resume speech" : "Play text as speech"}
                      data-testid="button-play-tts"
                    >
                      {audioState === "loading" ? (
                        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                      ) : audioState === "playing" ? (
                        <Pause className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <Play className="w-5 h-5" aria-hidden="true" />
                      )}
                      {audioState === "loading" ? "Loading..." : audioState === "playing" ? "Pause" : audioState === "paused" ? "Resume" : "Play"}
                    </Button>

                    {(audioState === "playing" || audioState === "paused") && (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handleStop}
                        aria-label="Stop speech playback"
                        data-testid="button-stop-tts"
                      >
                        <Square className="w-5 h-5" aria-hidden="true" />
                      </Button>
                    )}

                    <div className="flex items-center gap-2 ml-2">
                      <label htmlFor="voice-select" className="text-sm text-muted-foreground whitespace-nowrap">Voice</label>
                      <Select
                        value={selectedVoice}
                        onValueChange={(v) => setSelectedVoice(v as Voice)}
                        disabled={audioState === "playing" || audioState === "loading"}
                      >
                        <SelectTrigger id="voice-select" className="w-32" data-testid="select-voice" aria-label="Select voice for text-to-speech">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as Voice[]).map(v => (
                            <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport("txt")}
                      aria-label="Export decoded text as TXT file"
                      data-testid="button-export-txt"
                    >
                      <Download className="w-4 h-4 mr-1.5" aria-hidden="true" />
                      .txt
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport("json")}
                      aria-label="Export full scan data as JSON file"
                      data-testid="button-export-json"
                    >
                      <Download className="w-4 h-4 mr-1.5" aria-hidden="true" />
                      .json
                    </Button>
                  </div>
                </div>
              </motion.section>
            )}
          </div>

          {/* Right column: History */}
          <aside aria-labelledby="history-section-heading" className="rounded-xl border border-border bg-card overflow-hidden flex flex-col max-h-[calc(100vh-8rem)] sticky top-20">
            <div className="px-5 py-4 border-b border-border shrink-0">
              <h2 id="history-section-heading" className="text-base font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
                Scan History
              </h2>
              {stats && (
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span>Camera: {stats.byMode?.camera ?? 0}</span>
                  <span>Upload: {stats.byMode?.upload ?? 0}</span>
                  <span>Video: {stats.byMode?.video ?? 0}</span>
                </div>
              )}
            </div>

            <ScrollArea className="flex-1">
              {scansLoading ? (
                <div className="p-5 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : !scans || scans.length === 0 ? (
                <div className="p-5 flex flex-col items-center justify-center text-center text-muted-foreground py-16">
                  <Camera className="w-10 h-10 mb-3 opacity-30" aria-hidden="true" />
                  <p className="font-medium">No scans yet</p>
                  <p className="text-sm mt-1">Your scan history will appear here</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  <AnimatePresence>
                    {scans.map((scan) => (
                      <motion.button
                        key={scan.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        layout
                        onClick={() => setSelectedScanId(scan.id === selectedScanId ? null : scan.id)}
                        className={`w-full text-left rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group ${
                          selectedScanId === scan.id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:bg-muted/50"
                        }`}
                        aria-label={`View scan from ${new Date(scan.createdAt).toLocaleDateString()}, confidence ${Math.round(scan.confidence * 100)}%`}
                        aria-pressed={selectedScanId === scan.id}
                        data-testid={`card-scan-${scan.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="secondary"
                                className="text-xs capitalize shrink-0"
                                data-testid={`badge-mode-${scan.id}`}
                              >
                                {scan.mode}
                              </Badge>
                              <span
                                className={`text-xs font-semibold shrink-0 ${
                                  scan.confidence >= 0.85
                                    ? "text-emerald-500"
                                    : scan.confidence >= 0.6
                                    ? "text-amber-500"
                                    : "text-destructive"
                                }`}
                                data-testid={`text-confidence-${scan.id}`}
                              >
                                {Math.round(scan.confidence * 100)}%
                              </span>
                            </div>
                            <p className="text-sm text-foreground truncate" data-testid={`text-preview-${scan.id}`}>
                              {scan.correctedText.slice(0, 60)}{scan.correctedText.length > 60 ? "..." : ""}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(scan.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteScan(scan.id); }}
                            className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Delete scan from ${new Date(scan.createdAt).toLocaleDateString()}`}
                            data-testid={`button-delete-${scan.id}`}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </motion.button>
                    ))}
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
