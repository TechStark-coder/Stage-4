
"use client";

import { useState, useRef, useEffect, type DragEvent, type FormEvent, type ChangeEvent } from "react";
import * as React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, ImagePlus, Camera, Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MediaUploaderProps {
  onAnalysisComplete: () => void;
  currentFiles: File[];
  onFilesChange: (photos: File[]) => void;
  isAnalyzing: boolean;
  userId: string;
  onClearPendingMedia: () => void;
}

const MAX_FILES = 10;

export function MediaUploader({
  onAnalysisComplete,
  currentFiles,
  onFilesChange,
  isAnalyzing,
  userId,
  onClearPendingMedia
}: MediaUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const addNewFiles = (newFilesArray: File[]) => {
    const filteredNewFiles = newFilesArray.filter(file => {
      // Allow standard image and video types
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        return true;
      }
      // Specifically allow .mov files, which can have a generic 'application/octet-stream' MIME type
      if (file.name.toLowerCase().endsWith('.mov')) {
        return true;
      }
      return false; // Reject other files
    });

    if (filteredNewFiles.length !== newFilesArray.length) {
      toast({
        title: "Unsupported File Type",
        description: "Some files were not valid image or video types and were ignored.",
        variant: "destructive",
      });
    }
    
    const totalAfterAdd = currentFiles.length + filteredNewFiles.length;
    if (totalAfterAdd > MAX_FILES) {
      toast({
        title: `File Limit Exceeded`,
        description: `You can upload a maximum of ${MAX_FILES} files. ${MAX_FILES - currentFiles.length} more can be added.`,
        variant: "destructive",
      });
      const remainingSlots = MAX_FILES - currentFiles.length;
      const filesToAdd = filteredNewFiles.slice(0, remainingSlots);
       if (filesToAdd.length > 0) {
        onFilesChange([...currentFiles, ...filesToAdd]);
      }
    } else if (filteredNewFiles.length > 0) {
      onFilesChange([...currentFiles, ...filteredNewFiles]);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      addNewFiles(Array.from(files));
      if (event.target) {
        event.target.value = ""; 
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

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
      addNewFiles(Array.from(files));
    }
  };

  const openCamera = async () => {
    setHasCameraPermission(null);
    setCameraError(null);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setCameraStream(stream);
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Error accessing camera:", err);
        setHasCameraPermission(false);
        let message = "Could not access the camera.";
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          message = "Camera permission was denied. Please enable it in your browser settings.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          message = "No camera found on this device.";
        }
        setCameraError(message);
        toast({
          title: "Camera Error",
          description: message,
          variant: "destructive",
        });
      }
    } else {
      setCameraError("Camera access is not supported by your browser.");
      toast({
        title: "Unsupported Browser",
        description: "Camera access is not supported by your browser.",
        variant: "destructive",
      });
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setShowCameraDialog(false);
    setHasCameraPermission(null);
    setCameraError(null);
  };

  const handleSnapPhoto = () => {
    if (videoRef.current && canvasRef.current && cameraStream) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const newFile = new File([blob], 'capture_' + Date.now() + '.png', { type: 'image/png' });
            addNewFiles([newFile]);
            closeCamera();
          } else {
            toast({ title: "Capture Failed", description: "Could not capture image.", variant: "destructive"});
          }
        }, 'image/png');
      }
    }
  };
  
  React.useEffect(() => {
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


  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); 
    if (!userId) {
      toast({ title: "Authentication Error", description: "User ID is missing. Cannot upload media.", variant: "destructive" });
      return;
    }
    if (currentFiles.length === 0) {
      toast({
        title: "No Media Selected",
        description: "Please add or capture files before processing.",
        variant: "destructive",
      });
      return;
    }
    
    onAnalysisComplete();
  }

  return (
    <Card className="shadow-lg w-full h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-primary" /> Manage Room Media
        </CardTitle>
        <CardDescription>
          Add photos or videos via file upload, drag & drop, or camera. Max {MAX_FILES} files.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} className="flex flex-col flex-grow min-h-0">
        <CardContent className="p-6 flex-grow flex flex-col min-h-0">
          <div 
            className={`h-full flex flex-col justify-center items-center p-4 ${isDraggingOver ? 'drop-zone-active' : 'drop-zone'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Input
              id="media-input"
              type="file"
              multiple
              accept="image/*,video/*,.mov"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden" 
            />
            <div className="text-center text-muted-foreground py-4">
               Drag & drop images or videos here, or use buttons below.
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full px-4 sm:px-0">
              <Button type="button" onClick={triggerFileInput} variant="outline" className="flex-1" disabled={isAnalyzing}>
                  <ImagePlus className="mr-2 h-4 w-4" /> Add Files
              </Button>
              <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="flex-1" disabled={isAnalyzing}>
                    <Camera className="mr-2 h-4 w-4" /> Use Camera
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Capture Image</DialogTitle>
                    <DialogDescription>
                      Position the camera and click "Snap Photo".
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <video ref={videoRef} autoPlay muted playsInline className="camera-video-preview" />
                    <canvas ref={canvasRef} className="hidden"></canvas>
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
                  <DialogFooter className="gap-2 sm:gap-0 flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                    <Button variant="outline" onClick={closeCamera}>Cancel</Button>
                    <Button onClick={handleSnapPhoto} disabled={!cameraStream || hasCameraPermission === false || hasCameraPermission === null}>
                      Snap Photo
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
        <CardFooter className="p-6 border-t mt-auto">
          <Button 
            type="submit"
            className="w-full"
            disabled={isAnalyzing || currentFiles.length === 0 || !userId}
          >
            {isAnalyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isAnalyzing ? "Processing..." : `Process ${currentFiles.length} File(s)`}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
