
"use client";

import { useState, useRef, type DragEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, Film, Sparkles, Loader2, XCircle, Camera, Video as VideoIcon, PlayCircle } from "lucide-react";
import { FullScreenCamera } from "./FullScreenCamera"; // Import the new component
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VideoUploaderProps {
  onVideoChange: (files: File[]) => void;
  onAnalyze: (files: File[]) => void;
  isAnalyzing: boolean;
  videoFiles: File[];
}

const MAX_FILE_SIZE_MB = 100;

export function VideoUploader({ onVideoChange, onAnalyze, isAnalyzing, videoFiles }: VideoUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // State for video preview
  const [videoToPreview, setVideoToPreview] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  useEffect(() => {
    if (videoToPreview) {
      const url = URL.createObjectURL(videoToPreview);
      setPreviewUrl(url);
    } else {
      // Clean up the object URL when the dialog is closed
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoToPreview]);


  const handleNewFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      if (file.type && !file.type.startsWith("video/")) {
        // Allow .mov files that might have 'application/octet-stream' type
        if (file.type !== 'application/octet-stream' || !file.name.toLowerCase().endsWith('.mov')) {
            toast({ title: "Invalid File Type", description: `${file.name} is not a valid video file.`, variant: "destructive" });
            return false;
        }
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast({ title: "File Too Large", description: `${file.name} exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`, variant: "destructive" });
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      onVideoChange([...videoFiles, ...validFiles]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      handleNewFiles(Array.from(files));
      if (event.target) event.target.value = "";
    }
  };
  
  const handleRemoveFile = (indexToRemove: number) => {
    const updatedFiles = videoFiles.filter((_, index) => index !== indexToRemove);
    onVideoChange(updatedFiles);
  };
  
  const handleClearAllFiles = () => {
    onVideoChange([]);
    toast({ title: "Selection Cleared", description: "All selected videos have been removed."});
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      handleNewFiles(Array.from(files));
    }
  };
  
  const handleVideoRecorded = (videoFile: File) => {
    handleNewFiles([videoFile]);
    setShowCamera(false); // Close the full-screen camera view
  };

  return (
    <>
      <Card className="shadow-lg w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="h-6 w-6 text-primary" /> Upload & Analyze Videos
          </CardTitle>
          <CardDescription>
            Provide videos of the room for AI analysis. Supports MP4, MOV, and other common formats.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col">
          <div 
            className={`flex-grow flex flex-col justify-center items-center p-4 ${isDraggingOver ? 'drop-zone-active' : 'drop-zone'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Input
              id="video-input"
              type="file"
              multiple
              accept="video/*,.mov,.mp4"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
            />
            <div className="text-center text-muted-foreground">
              <Film className="mx-auto h-12 w-12 opacity-50 mb-2" />
              Drag & drop videos here, or use the buttons below.
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Button type="button" onClick={triggerFileInput} variant="outline" disabled={isAnalyzing}>
                <VideoIcon className="mr-2 h-4 w-4" /> Select Files
              </Button>
               <Button type="button" onClick={() => setShowCamera(true)} variant="outline" disabled={isAnalyzing}>
                <Camera className="mr-2 h-4 w-4" /> Record Video
              </Button>
            </div>
          </div>
          
          {videoFiles.length > 0 && (
            <div className="mt-4 space-y-2 pt-4 border-t">
              <div className="flex justify-between items-center">
                 <h4 className="text-sm font-medium text-muted-foreground">Selected Videos ({videoFiles.length}):</h4>
                 <Button variant="link" size="sm" className="text-destructive h-auto p-0" onClick={handleClearAllFiles}>
                    Clear
                 </Button>
              </div>
              <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {videoFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between bg-muted/50 p-2 rounded-md group">
                    <button type="button" className="flex items-center gap-2 text-sm truncate pr-2 text-left" onClick={() => setVideoToPreview(file)}>
                      <PlayCircle className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      {file.name}
                    </button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFile(index)}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter className="p-6 border-t">
          <Button
            onClick={() => onAnalyze(videoFiles)}
            className="w-full"
            disabled={isAnalyzing || videoFiles.length === 0}
          >
            {isAnalyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isAnalyzing ? "Analyzing..." : `Analyze ${videoFiles.length} Video(s)`}
          </Button>
        </CardFooter>
      </Card>
      
      {showCamera && (
        <FullScreenCamera
          onClose={() => setShowCamera(false)}
          onVideoRecorded={handleVideoRecorded}
        />
      )}

      <Dialog open={!!videoToPreview} onOpenChange={(isOpen) => !isOpen && setVideoToPreview(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Video Preview</DialogTitle>
            <DialogDescription>{videoToPreview?.name}</DialogDescription>
          </DialogHeader>
          {previewUrl && (
             <video src={previewUrl} controls autoPlay className="w-full rounded-md bg-black" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
