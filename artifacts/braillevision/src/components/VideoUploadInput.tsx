import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Film, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoUploadInputProps {
  onCapture: (base64: string, mimeType: string) => void;
  disabled?: boolean;
}

export function VideoUploadInput({ onCapture, disabled }: VideoUploadInputProps) {
  const [extracting, setExtracting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const extractFrame = (file: File) => {
    setExtracting(true);
    const url = URL.createObjectURL(file);
    if (!videoRef.current || !canvasRef.current) {
      setExtracting(false);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    video.onloadeddata = () => {
      // Seek to 1 second in or middle of video to find a good frame
      video.currentTime = Math.min(1, video.duration / 2);
    };

    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg");
        onCapture(base64, "image/jpeg");
      }
      URL.revokeObjectURL(url);
      setExtracting(false);
    };

    video.src = url;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      extractFrame(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/mp4": [], "video/webm": [], "video/quicktime": [] },
    multiple: false,
    disabled: disabled || extracting
  });

  return (
    <div className="relative">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          ${isDragActive ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted/50"}
          ${(disabled || extracting) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        role="button"
        aria-label="Upload video for frame extraction. Drag and drop a video file, or click to browse."
        data-testid="video-upload-dropzone"
      >
        <input {...getInputProps()} data-testid="input-video-upload" />
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-background rounded-full border border-border">
            {extracting ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : isDragActive ? (
              <Upload className="w-8 h-8 text-primary" />
            ) : (
              <Film className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">
              {extracting ? "Extracting frame..." : isDragActive ? "Drop video here..." : "Drag & Drop Video"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse. A clear frame will be automatically extracted.
            </p>
          </div>
        </div>
      </div>
      
      {/* Hidden elements for processing */}
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
