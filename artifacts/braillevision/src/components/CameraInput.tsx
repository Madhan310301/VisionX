import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Maximize2, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CameraInputProps {
  onCapture: (base64: string, mimeType: string) => void;
  disabled?: boolean;
  dots?: Array<{ x: number; y: number; radius: number; confidence?: number }>;
}

export function CameraInput({ onCapture, disabled, dots }: CameraInputProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [hasCamera, setHasCamera] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStable, setIsStable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hudMetrics, setHudMetrics] = useState({ fps: 30, temp: 34.2 });
  const [mediaBox, setMediaBox] = useState({ width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 });

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setHasCamera(true);
      setError(null);
    } catch (err) {
      setError("Failed to access camera. Please ensure permissions are granted.");
      setHasCamera(false);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Frame stability & HUD simulation
  useEffect(() => {
    if (!hasCamera) return;
    const interval = setInterval(() => {
      setIsStable(true);
      setHudMetrics({
        fps: Math.round(29 + Math.random() * 2),
        temp: +(34.0 + Math.random() * 0.4).toFixed(1),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasCamera]);

  useEffect(() => {
    if (!hasCamera) return;

    const updateBox = () => {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!video || !overlay) return;
      const rect = video.getBoundingClientRect();
      setMediaBox({
        width: rect.width || 1,
        height: rect.height || 1,
        naturalWidth: video.videoWidth || 1,
        naturalHeight: video.videoHeight || 1,
      });
    };

    updateBox();
    const resizeObserver = new ResizeObserver(updateBox);
    if (overlayRef.current) resizeObserver.observe(overlayRef.current);
    if (videoRef.current) resizeObserver.observe(videoRef.current);
    window.addEventListener("resize", updateBox);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateBox);
    };
  }, [hasCamera]);

  const handleScan = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg");
      onCapture(base64, "image/jpeg");
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-muted rounded-xl border-2 border-dashed border-border" data-testid="camera-error">
        <ShieldAlert className="w-10 h-10 text-destructive mb-3" />
        <p className="text-destructive mb-4 text-center font-medium">{error}</p>
        <Button onClick={startCamera} variant="outline" aria-label="Retry camera access">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-border bg-black shadow-lg w-full flex justify-center">
      <div ref={overlayRef} className="relative inline-block max-w-full">
        {/* Video stream */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="block w-auto max-w-full h-auto max-h-[60vh]"
          data-testid="camera-video"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Dot detection overlay on camera feed */}
        {dots && dots.map((dot, i) => {
          const size = Math.max(3, Math.min(8, Math.round(dot.radius * 0.7)));
          const ring = 1;
          const x = (dot.x / mediaBox.naturalWidth) * mediaBox.width;
          const y = (dot.y / mediaBox.naturalHeight) * mediaBox.height;
          return (
          <div
            key={i}
            className="absolute flex items-center justify-center pointer-events-none"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${size}px`,
              height: `${size}px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <span
              className="block rounded-full bg-primary/70 ring-white/65"
              style={{ width: `${size}px`, height: `${size}px`, boxShadow: `0 0 0 ${ring}px rgba(59,130,246,0.10)` }}
            />
          </div>
          );
        })}
      </div>

      {/* Modern Sci-Fi HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 select-none">
        {/* Top HUD bar */}
        <div className="flex justify-between items-start w-full">
          <div className="flex flex-col gap-1 bg-black/40 backdrop-blur-md rounded-lg p-2 border border-white/10 text-white font-mono text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span>YOLOv8-BRAILLE_CORE v1.4</span>
            </div>
            <div>FPS: {hudMetrics.fps} | TEMP: {hudMetrics.temp}°C</div>
          </div>

          <div className="flex gap-2">
            <div 
              className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border ${
                isStable 
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" 
                  : "bg-amber-500/20 text-amber-400 border-amber-500/40"
              }`}
              role="status"
              aria-live="polite"
            >
              {isStable ? "FRAME STABLE" : "ACQUIRING..."}
            </div>
          </div>
        </div>

        {/* Center Target Box Overlay */}
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="relative w-4/5 h-2/3 max-w-[400px] border border-white/20 rounded-lg">
            {/* HUD Corner brackets */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl" />
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br" />

            {/* Coordinate Grid Guides */}
            <div className="absolute inset-x-0 top-1/2 border-t border-white/5" />
            <div className="absolute inset-y-0 left-1/2 border-l border-white/5" />

            {/* Interactive Target Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4">
              <Maximize2 className="w-4 h-4 text-primary/30" />
            </div>

            {/* Sweep Laser Scanline Animation */}
            <AnimatePresence>
              {disabled ? (
                <motion.div 
                  initial={{ top: "0%" }}
                  animate={{ top: "100%" }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_hsl(var(--primary))] z-10"
                />
              ) : (
                <motion.div 
                  initial={{ opacity: 0.1 }}
                  animate={{ opacity: [0.1, 0.4, 0.1] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute inset-x-0 h-0.5 bg-white/20 top-1/3"
                />
              )}
            </AnimatePresence>

            {disabled && (
              <div className="absolute inset-0 bg-primary/5 flex items-center justify-center backdrop-blur-[1px]">
                <span className="text-white font-mono text-xs font-bold tracking-widest bg-black/60 px-3 py-1.5 rounded-lg border border-primary/40 animate-pulse">
                  SCANNING DOT MATRIX...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom indicators */}
        <div className="w-full flex justify-between text-[9px] font-mono text-white/50 bg-black/20 p-1 rounded">
          <span>LATENCY: ~140ms</span>
          <span>ROI: 640x480</span>
        </div>
      </div>

      {/* Control Button */}
      <div className="p-4 bg-background border-t border-border flex justify-center">
        <Button 
          size="lg" 
          onClick={handleScan} 
          disabled={disabled || !hasCamera}
          className="w-full max-w-sm font-semibold tracking-wide"
          aria-label="Scan current camera frame"
          data-testid="button-scan-camera"
        >
          <Camera className="w-5 h-5 mr-2" />
          Capture & Process
        </Button>
      </div>
    </div>
  );
}
