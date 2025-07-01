
"use client";

import { useState, useRef, useEffect, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, Film, Camera, Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter as DialogModalFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface VideoUploaderProps {
  onVideoChange: (file: File | null) => void;
  onAnalyze: (file: File) => void;
  isAnalyzing: boolean;
  videoFile: File | null;
}

const MAX_FILE_SIZE_MB = 100;

export function VideoUploader({ onVideoChange, onAnalyze, isAnalyzing, videoFile }: VideoUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);


  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setVideoPreviewUrl(null);
    }
  }, [videoFile]);


  const handleNewFile = (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a valid video file.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `Video file size cannot exceed ${MAX_FILE_SIZE_MB}MB.`,
        variant: "destructive",
      });
      return;
    }
    onVideoChange(file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleNewFile(file);
      if (event.target) event.target.value = "";
    }
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
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleNewFile(file);
    }
  };
  
  const openCamera = async () => {
    setHasCameraPermission(null);
    setCameraError(null);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        setCameraStream(stream);
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err: any) {
        setHasCameraPermission(false);
        let message = "Could not access the camera.";
        if (err.name === "NotAllowedError") message = "Camera permission denied. Please enable it in browser settings.";
        else if (err.name === "NotFoundError") message = "No camera found.";
        setCameraError(message);
        toast({ title: "Camera Error", description: message, variant: "destructive" });
      }
    } else {
      setCameraError("Camera access not supported by your browser.");
      toast({ title: "Unsupported Browser", description: "Camera access not supported.", variant: "destructive" });
    }
  };

  const closeCamera = () => {
    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null);
    setShowCameraDialog(false);
  };

  const handleStartRecording = () => {
    if (!cameraStream) return;
    const mediaRecorder = new MediaRecorder(cameraStream);
    const chunks: BlobPart[] = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const file = new File([blob], `recording_${Date.now()}.webm`, { type: 'video/webm' });
        handleNewFile(file);
        closeCamera();
    };
    mediaRecorder.start();
    toast({ title: "Recording Started!", description: "Press 'Stop Recording' to finish.", duration: 5000 });

    // Add a stop button logic or timeout
    const stopButton = document.getElementById('stop-recording-btn');
    if(stopButton) {
        stopButton.onclick = () => mediaRecorder.stop();
    }
  };
  
  useEffect(() => {
    if (showCameraDialog) openCamera();
    return () => { cameraStream?.getTracks().forEach(track => track.stop()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCameraDialog]);

  return (
    <Card className="shadow-lg w-full h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-primary" /> Upload & Analyze Video
        </CardTitle>
        <CardDescription>
          Provide a video of the room for AI analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
         {videoPreviewUrl ? (
             <div className="w-full aspect-video rounded-md overflow-hidden border relative">
                <video src={videoPreviewUrl} controls className="w-full h-full object-cover" />
                <Button variant="destructive" size="sm" onClick={() => onVideoChange(null)} className="absolute top-2 right-2 z-10">Clear</Button>
            </div>
         ) : (
            <div 
              className={`h-full flex flex-col justify-center items-center ${isDraggingOver ? 'drop-zone-active' : 'drop-zone'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Input
                  id="video-input"
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden" 
                />
              <div className="text-center text-muted-foreground py-4">
                 Drag & drop a video here, or use buttons below.
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full px-4 sm:px-0">
                <Button type="button" onClick={triggerFileInput} variant="outline" className="flex-1" disabled={isAnalyzing}>
                    <Film className="mr-2 h-4 w-4" /> Upload Video
                </Button>
                <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" className="flex-1" disabled={isAnalyzing}>
                      <Camera className="mr-2 h-4 w-4" /> Record Video
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>Record Video</DialogTitle>
                      <DialogDescription>Click record, capture video, then stop.</DialogDescription>
                    </DialogHeader>
                     <div className="py-4 space-y-4">
                      <video ref={videoRef} autoPlay muted playsInline className="camera-video-preview" />
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
                    <DialogModalFooter className="gap-2 sm:gap-0">
                      <Button variant="outline" onClick={closeCamera}>Cancel</Button>
                      <Button id="stop-recording-btn" variant="destructive" className="hidden">Stop Recording</Button>
                      <Button onClick={handleStartRecording} disabled={!cameraStream}>Record</Button>
                    </DialogModalFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
         )}
      </CardContent>
      <CardFooter className="p-6 border-t">
        <Button 
          onClick={() => videoFile && onAnalyze(videoFile)}
          className="w-full"
          disabled={isAnalyzing || !videoFile}
        >
          {isAnalyzing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {isAnalyzing ? "Analyzing..." : `Analyze Video`}
        </Button>
      </CardFooter>
    </Card>
  );
}
