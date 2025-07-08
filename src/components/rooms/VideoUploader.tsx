
"use client";

import { useState, useRef, useEffect, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, Film, Sparkles, Loader2, XCircle, Camera, Video as VideoIcon, Radio } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


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

  // State for camera recording dialog
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);


  const handleNewFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      // Allow files with no MIME type (common with .mov) but reject if type exists and is not video
      if (file.type && !file.type.startsWith("video/")) {
        toast({ title: "Invalid File Type", description: `${file.name} is not a valid video file.`, variant: "destructive" });
        return false;
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

  // Camera and Recording Logic
  const openCamera = async () => {
    setHasCameraPermission(null);
    setCameraError(null);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setCameraStream(stream);
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Error accessing camera:", err);
        setHasCameraPermission(false);
        const message = "Could not access the camera. Please enable permissions in your browser settings.";
        setCameraError(message);
        toast({ title: "Camera Error", description: message, variant: "destructive" });
      }
    } else {
      setCameraError("Camera access is not supported by your browser.");
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setCameraStream(null);
    setShowCameraDialog(false);
    setHasCameraPermission(null);
    setCameraError(null);
    setIsRecording(false);
  };

  const handleStartRecording = () => {
    if (!cameraStream) return;
    setIsRecording(true);
    recordedChunksRef.current = [];
    // Prefer webm for broad compatibility, but browser may fall back
    const options = { mimeType: 'video/webm; codecs=vp9' }; 
    mediaRecorderRef.current = new MediaRecorder(cameraStream, options);

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'video/webm' });
      handleNewFiles([file]);
      closeCamera();
    };

    mediaRecorderRef.current.start();
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  useEffect(() => {
    if (showCameraDialog) {
      openCamera();
    }
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCameraDialog]);

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
               <Button type="button" onClick={() => setShowCameraDialog(true)} variant="outline" disabled={isAnalyzing}>
                <Camera className="mr-2 h-4 w-4" /> Record Video
              </Button>
            </div>
          </div>
          
          {videoFiles.length > 0 && (
            <div className="mt-4 space-y-2 pt-4 border-t">
              <h4 className="text-sm font-medium text-muted-foreground">Selected Videos ({videoFiles.length}):</h4>
              <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {videoFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
                    <span className="text-sm truncate pr-2">{file.name}</span>
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
      
      {/* Camera Dialog */}
       <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Record Video</DialogTitle>
            <DialogDescription>
              {isRecording ? "Recording in progress..." : "Position the camera and click record."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <video ref={videoRef} autoPlay muted playsInline className="w-full aspect-video rounded-md bg-black" />
            {hasCameraPermission === false && cameraError && (
              <Alert variant="destructive">
                <Camera className="h-4 w-4" />
                <AlertTitle>Camera Access Error</AlertTitle>
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            )}
            {hasCameraPermission === null && !cameraError && (
              <div className="flex items-center justify-center text-muted-foreground"> 
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Requesting camera access...
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 flex-col-reverse sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={closeCamera}>Cancel</Button>
            {!isRecording ? (
              <Button onClick={handleStartRecording} disabled={!cameraStream}>
                <Radio className="mr-2 h-4 w-4 text-red-500 animate-pulse" /> Record
              </Button>
            ) : (
              <Button onClick={handleStopRecording} variant="destructive">
                Stop Recording
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
