import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Image as ImageIcon, Upload } from "lucide-react";

interface ImageUploadInputProps {
  onCapture: (dataUrl: string, mimeType: string) => void;
  disabled?: boolean;
}

export function ImageUploadInput({ onCapture, disabled }: ImageUploadInputProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onCapture(reader.result, file.type);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [onCapture]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: false,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${isDragActive ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted/50"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      role="button"
      aria-label="Upload Braille image. Drag and drop a JPEG or PNG file, or click to browse."
      data-testid="image-upload-dropzone"
    >
      <input {...getInputProps()} data-testid="input-image-upload" />
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="p-4 bg-background rounded-full border border-border">
          {isDragActive ? (
            <Upload className="w-8 h-8 text-primary" aria-hidden="true" />
          ) : (
            <ImageIcon className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div>
          <p className="text-lg font-medium text-foreground">
            {isDragActive ? "Drop image here..." : "Drag and Drop Image"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to browse — JPG, PNG, or WebP accepted
          </p>
        </div>
      </div>
    </div>
  );
}
