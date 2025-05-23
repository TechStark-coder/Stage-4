
"use client";

import { useState, useRef, useEffect, type DragEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { describeRoomObjects, type DescribeRoomObjectsInput } from "@/ai/flows/describe-room-objects";
import { setRoomAnalyzingStatus } from "@/lib/firestore";
import { photoUploadSchema, type PhotoUploadFormData } from "@/schemas/roomSchemas";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, ImagePlus, Camera } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useAiAnalysisLoader } from "@/contexts/AiAnalysisLoaderContext";
import { storage } from "@/config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

interface PhotoUploaderProps {
  homeId: string;
  roomId: string;
  userId: string;
  onAnalysisComplete: (
    analysisSuccessful: boolean,
    objectNames?: string[],
    photoUrls?: string[]
  ) => void;
  currentPhotos: File[];
  onPhotosChange: (photos: File[]) => void;
}

const MAX_PHOTOS = 10; // Max number of photos allowed

export function PhotoUploader({
  homeId,
  roomId,
  userId,
  onAnalysisComplete,
  currentPhotos,
  onPhotosChange
}: PhotoUploaderProps) {
  const { toast } = useToast();
  const { showAiLoader, hideAiLoader } = useAiAnalysisLoader();
  const [isAnalyzingLocal, setIsAnalyzingLocal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<PhotoUploadFormData>({
    resolver: zodResolver(photoUploadSchema),
    // No defaultValues needed here as we manage File objects directly
  });

  const addNewFiles = (newFilesArray: File[]) => {
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const filteredNewFiles = newFilesArray.filter(file => validImageTypes.includes(file.type));

    if (filteredNewFiles.length !== newFilesArray.length) {
      toast({
        title: "Invalid File Type",
        description: "Some files were not valid image types and were not added.",
        variant: "destructive",
      });
    }
    
    const totalAfterAdd = currentPhotos.length + filteredNewFiles.length;
    if (totalAfterAdd > MAX_PHOTOS) {
      toast({
        title: "Photo Limit Exceeded",
        description: `You can upload a maximum of ${MAX_PHOTOS} photos. ${MAX_PHOTOS - currentPhotos.length} more can be added.`,
        variant: "destructive",
      });
      const remainingSlots = MAX_PHOTOS - currentPhotos.length;
      const filesToAdd = filteredNewFiles.slice(0, remainingSlots);
       if (filesToAdd.length > 0) {
        onPhotosChange([...currentPhotos, ...filesToAdd]);
      }
    } else if (filteredNewFiles.length > 0) {
      onPhotosChange([...currentPhotos, ...filteredNewFiles]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
            const newFile = new File([blob], `capture_${Date.now()}.png`, { type: 'image/png' });
            addNewFiles([newFile]);
            closeCamera();
          } else {
            toast({ title: "Capture Failed", description: "Could not capture image.", variant: "destructive"});
          }
        }, 'image/png');
      }
    }
  };
  
  useEffect(() => {
    if (showCameraDialog) {
      openCamera();
    }
    // Cleanup function to stop camera stream when component unmounts or dialog closes
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCameraDialog]);


  async function onSubmit() {
    if (currentPhotos.length === 0) {
      toast({
        title: "No Photos",
        description: "Please add or capture photos before analyzing.",
        variant: "destructive",
      });
      return;
    }
    if (!userId) {
      toast({ title: "Error", description: "User not identified. Cannot upload photos.", variant: "destructive" });
      return;
    }

    showAiLoader();
    setIsAnalyzingLocal(true);
    
    let analysisSuccessful = false;
    let uploadedImageUrls: string[] = [];
    let aiObjectNames: string[] | undefined = undefined;

    try {
      await setRoomAnalyzingStatus(homeId, roomId, true);

      toast({ title: "Uploading Photos...", description: `Starting upload of ${currentPhotos.length} photo(s).`, duration: 2000 });
      
      for (let i = 0; i < currentPhotos.length; i++) {
        const file = currentPhotos[i];
        const uniqueFileName = `${Date.now()}-${file.name.replace(/\s+/g, '_').replace(/[^\w.-]/g, '')}`;
        const imagePath = `roomAnalysisPhotos/${userId}/${roomId}/${uniqueFileName}`;
        const imageStorageRef = ref(storage, imagePath);
        
        toast({ title: `Uploading ${i+1}/${currentPhotos.length}`, description: file.name, duration: 1500});
        await uploadBytes(imageStorageRef, file);
        const downloadURL = await getDownloadURL(imageStorageRef);
        uploadedImageUrls.push(downloadURL);
      }
      toast({ title: "Upload Complete", description: "All photos uploaded. Starting AI analysis...", duration: 2000 });

      const aiInput: DescribeRoomObjectsInput = { photoDataUris: uploadedImageUrls };
      const result = await describeRoomObjects(aiInput);
      aiObjectNames = result.objectNames;
      analysisSuccessful = true;
      
    } catch (error: any) {
      console.error("Error during photo upload or AI Analysis:", error);
      toast({
        title: "Analysis Process Failed",
        description: error.message || "Could not upload photos or get AI description.",
        variant: "destructive",
      });
      analysisSuccessful = false;
      try {
        await setRoomAnalyzingStatus(homeId, roomId, false);
      } catch (statusError) {
        console.error("Error resetting analyzing status after failure:", statusError);
      }
    } finally {
      setIsAnalyzingLocal(false);
      onAnalysisComplete(
        analysisSuccessful, 
        analysisSuccessful ? aiObjectNames : undefined, 
        analysisSuccessful ? uploadedImageUrls : []
      );
      hideAiLoader(); 
    }
  }

  return (
    <Card className="shadow-lg w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-primary" /> Manage Room Photos
        </CardTitle>
        <CardDescription>
          Add photos via file upload, drag & drop, or capture from camera. Max {MAX_PHOTOS} photos.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
          <CardContent 
            className={`space-y-4 p-4 drop-zone ${isDraggingOver ? 'drop-zone-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
              <FormField
                control={form.control}
                name="photos" 
                render={() => (
                  <FormItem>
                    <Input
                        id="photos-input"
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,image/gif" 
                        onChange={handleFileChange}
                        ref={fileInputRef}
                        className="hidden" 
                      />
                    <FormMessage /> 
                    <div className="text-center text-muted-foreground py-4">
                       Drag & drop images here, or use buttons below.
                    </div>
                  </FormItem>
                )}
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="button" onClick={triggerFileInput} variant="outline" className="flex-1">
                    <ImagePlus className="mr-2 h-4 w-4" /> Add Photos
                </Button>
                <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" className="flex-1">
                      <Camera className="mr-2 h-4 w-4" /> Capture Image
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
                          <AlertTitle>Camera Access Error</AlertTitle>
                          <AlertDescription>{cameraError}</AlertDescription>
                        </Alert>
                      )}
                       {hasCameraPermission === null && !cameraError && (
                        <p className="text-center text-muted-foreground">Requesting camera access...</p>
                      )}
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0 flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                      <Button variant="outline" onClick={closeCamera}>Cancel</Button>
                      <Button onClick={handleSnapPhoto} disabled={!cameraStream || hasCameraPermission === false}>Snap Photo</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
          </CardContent>
          <CardFooter className="p-4">
            <button 
              type="submit" 
              className="analyze-button-animated w-full"
              disabled={isAnalyzingLocal || currentPhotos.length === 0}
            >
              <div className="dots_border"></div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="sparkle"
              >
                <path
                  className="path"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  stroke="currentColor" 
                  fill="currentColor"
                  d="M14.187 8.096L15 5.25L15.813 8.096C16.0231 8.83114 16.4171 9.50062 16.9577 10.0413C17.4984 10.5819 18.1679 10.9759 18.903 11.186L21.75 12L18.904 12.813C18.1689 13.0231 17.4994 13.4171 16.9587 13.9577C16.4181 14.4984 16.0241 15.1679 15.814 15.903L15 18.75L14.187 15.904C13.9769 15.1689 13.5829 14.4994 13.0423 13.9587C12.5016 13.4181 11.8321 13.0241 11.097 12.814L8.25 12L11.096 11.187C11.8311 10.9769 12.5006 10.5829 13.0413 10.0423C13.5819 9.50162 13.9759 8.83214 14.186 8.097L14.187 8.096Z"
                ></path>
                <path
                  className="path"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="currentColor"
                  d="M6 14.25L5.741 15.285C5.59267 15.8785 5.28579 16.4206 4.85319 16.8532C4.42059 17.2858 3.87853 17.5927 3.285 17.741L2.25 18L3.285 18.259C3.87853 18.4073 4.42059 18.7142 4.85319 19.1468C5.28579 19.5794 5.59267 20.1215 5.741 20.715L6 21.75L6.259 20.715C6.40725 20.1216 6.71398 19.5796 7.14639 19.147C7.5788 18.7144 8.12065 18.4075 8.714 18.259L9.75 18L8.714 17.741C8.12065 17.5925 7.5788 17.2856 7.14639 16.853C6.71398 16.4204 6.40725 15.8784 6.259 15.285L6 14.25Z"
                ></path>
                <path
                  className="path"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="currentColor"
                  d="M6.5 4L6.303 4.5915C6.24777 4.75718 6.15472 4.90774 6.03123 5.03123C5.90774 5.15472 5.75718 5.24777 5.5915 5.303L5 5.5L5.5915 5.697C5.75718 5.75223 5.90774 5.84528 6.03123 5.96877C6.15472 6.09226 6.24777 6.24282 6.303 6.4085L6.5 7L6.697 6.4085C6.75223 6.24282 6.84528 6.09226 6.96877 5.96877C7.09226 5.84528 7.24282 5.75223 7.4085 5.697L8 5.5L7.4085 5.303C7.24282 5.24777 7.09226 5.15472 6.96877 5.03123C6.84528 4.90774 6.75223 4.75718 6.697 4.5915L6.5 4Z"
                ></path>
              </svg>
              <span className="text_button">{isAnalyzingLocal ? "Analyzing..." : "Analyze Images"}</span>
            </button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
