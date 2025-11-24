import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface UploadZoneProps {
  onFileSelect?: (file: File) => void;
  accept?: string;
}

export function UploadZone({ onFileSelect, accept = ".ics" }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const file = files[0];
      if (file) {
        setSelectedFile(file);
        onFileSelect?.(file);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSelectedFile(file);
        onFileSelect?.(file);
      }
    },
    [onFileSelect]
  );

  const clearFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  return (
    <Card
      className={`p-8 border-2 border-dashed transition-colors ${
        isDragging ? "border-primary bg-accent" : "border-border"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="card-upload-zone"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        {selectedFile ? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium" data-testid="text-selected-file">{selectedFile.name}</p>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearFile}
                data-testid="button-clear-file"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(2)} KB
            </p>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Drop your .ics file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
            </div>
            <label htmlFor="file-upload">
              <Button variant="outline" size="sm" asChild data-testid="button-browse-file">
                <span>Browse Files</span>
              </Button>
              <input
                id="file-upload"
                type="file"
                accept={accept}
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
          </>
        )}
      </div>
    </Card>
  );
}
