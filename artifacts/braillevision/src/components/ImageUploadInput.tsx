import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Image as ImageIcon, Upload, FileImage, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface ImageUploadInputProps {
  onCapture: (dataUrl: string, mimeType: string) => void;
  disabled?: boolean;
  dots?: Array<{ x: number; y: number; radius: number; confidence?: number }>;
}

export function ImageUploadInput({ onCapture, disabled, dots }: ImageUploadInputProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [fileDetails, setFileDetails] = useState<{ name: string; size: string } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mediaBox, setMediaBox] = useState({ width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setPreviewUrl(reader.result);
          setMimeType(file.type);
          setFileDetails({
            name: file.name,
            size: (file.size / 1024).toFixed(1) + " KB",
          });
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: false,
    disabled: disabled,
  });

  const handleProcess = () => {
    if (previewUrl) {
      onCapture(previewUrl, mimeType);
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewUrl(null);
    setFileDetails(null);
  };

  useEffect(() => {
    if (!previewUrl) return;

    const updateBox = () => {
      const img = imageRef.current;
      const overlay = overlayRef.current;
      if (!img || !overlay) return;
      const rect = img.getBoundingClientRect();
      setMediaBox({
        width: rect.width || 1,
        height: rect.height || 1,
        naturalWidth: img.naturalWidth || 1,
        naturalHeight: img.naturalHeight || 1,
      });
    };

    updateBox();
    const resizeObserver = new ResizeObserver(updateBox);
    if (overlayRef.current) resizeObserver.observe(overlayRef.current);
    if (imageRef.current) resizeObserver.observe(imageRef.current);
    window.addEventListener("resize", updateBox);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateBox);
    };
  }, [previewUrl]);

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {!previewUrl ? (
          <div
            {...getRootProps()}
            className="focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/40 rounded-xl"
          >
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                ${isDragActive ? "border-primary bg-primary/10 scale-[0.99] shadow-inner glow-md" : "border-primary/30 bg-card hover:bg-card/80 hover:border-primary/50"}
                ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              role="button"
              aria-label="Upload Braille image. Drag and drop a JPEG or PNG file, or click to browse."
              data-testid="image-upload-dropzone"
            >
              <input {...getInputProps()} data-testid="input-image-upload" />
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="glow-sm rounded-full">
                  <div className="p-4 bg-card rounded-full border border-border shadow-sm">
                    {isDragActive ? (
                      <Upload className="w-8 h-8 text-primary animate-bounce" aria-hidden="true" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {isDragActive ? "Drop image here..." : "Drag and Drop Image"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1.5 max-w-[280px] mx-auto leading-relaxed">
                    Support JPEG, PNG, or WebP. Images will be processed locally in real-time.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="relative rounded-xl overflow-hidden border border-border bg-black shadow-lg"
          >
            {/* Image Preview Container */}
            <div className="relative flex justify-center bg-zinc-950 max-h-[60vh] overflow-auto w-full">
              <div ref={overlayRef} className="relative inline-block max-w-full">
                <img
                  ref={imageRef}
                  src={previewUrl}
                  alt="Braille scan preview"
                  className="block w-auto max-w-full h-auto max-h-[50vh]"
                />

                {/* Dot detection overlay */}
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

              {/* High-Tech HUD Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 font-mono">
                <div className="flex justify-between items-start">
                  <div className="bg-black/60 backdrop-blur-md text-white text-[10px] p-2 rounded-lg border border-white/10 flex items-center gap-2">
                    <FileImage className="w-3.5 h-3.5 text-primary" />
                    <div>
                      <div>FILE: {fileDetails?.name}</div>
                      <div>SIZE: {fileDetails?.size}</div>
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-sm px-3.5 py-1.5 rounded-full font-bold backdrop-blur-sm shadow-md flex items-center gap-2 glow-success"
                  >
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    IMAGE READY
                  </motion.div>
                </div>

                {/* Corner crosshairs */}
                <div className="absolute inset-4 border border-white/10 rounded-lg">
                  <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-primary" />
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-primary" />
                  <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-primary" />
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-primary" />

                  {/* Sweep Laser Scanline Animation */}
                  <AnimatePresence>
                    {disabled && (
                      <motion.div
                        initial={{ top: "0%" }}
                        animate={{ top: "100%" }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_hsl(var(--primary))] z-10"
                      />
                    )}
                  </AnimatePresence>

                  {disabled && (
                    <div className="absolute inset-0 bg-primary/5 flex items-center justify-center backdrop-blur-[1px]">
                      <span className="text-white font-mono text-xs font-bold tracking-widest bg-black/60 px-3 py-1.5 rounded-lg border border-primary/40 animate-pulse">
                        DECODING CHARACTERS...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div className="p-4 bg-card border-t border-border flex gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={disabled}
                className="font-medium shrink-0"
                aria-label="Remove uploaded image"
              >
                Clear File
              </Button>
              <Button
                onClick={handleProcess}
                disabled={disabled}
                className={`flex-1 h-14 text-base font-semibold tracking-wide ${!disabled ? "gradient-btn" : ""}`}
                aria-label="Run Braille scanning engine"
              >
                {disabled ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing dots...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Process & Decode
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
