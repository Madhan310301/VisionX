import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw } from "lucide-react";

interface CameraInputProps {
  onCapture: (base64: string, mimeType: string) => void;
  disabled?: boolean;
}

export function CameraInput({ onCapture, disabled }: CameraInputProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCamera, setHasCamera] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStable, setIsStable] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Basic stability detection placeholder
  useEffect(() => {
    if (!hasCamera) return;
    const interval = setInterval(() => {
      // In a real app we'd compare frame diffs. For now, assume stable if running.
      setIsStable(true);
    }, 1000);
    return () => clearInterval(interval);
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
      <div className="flex flex-col items-center justify-center p-8 bg-muted rounded-lg border-2 border-dashed border-border" data-testid="camera-error">
        <p className="text-destructive mb-4 text-center">{error}</p>
        <Button onClick={startCamera} variant="outline" aria-label="Retry camera access">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-border bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-auto max-h-[60vh] object-contain"
        data-testid="camera-video"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="absolute top-4 right-4 flex gap-2">
        <div 
          className={`px-3 py-1 rounded-full text-xs font-medium ${isStable ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/50" : "bg-amber-500/20 text-amber-500 border border-amber-500/50"}`}
          role="status"
          aria-live="polite"
        >
          {isStable ? "Frame Stable" : "Unstable Frame"}
        </div>
      </div>

      <div className="p-4 bg-background border-t border-border flex justify-center">
        <Button 
          size="lg" 
          onClick={handleScan} 
          disabled={disabled || !hasCamera}
          className="w-full max-w-sm font-semibold"
          aria-label="Scan current camera frame"
          data-testid="button-scan-camera"
        >
          <Camera className="w-5 h-5 mr-2" />
          Capture & Scan
        </Button>
      </div>
    </div>
  );
}
