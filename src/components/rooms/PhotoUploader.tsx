
"use client";

import { useState, useRef, useEffect, type DragEvent, type MouseEvent as ReactMouseEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { describeRoomObjects, type DescribeRoomObjectsInput } from "@/ai/flows/describe-room-objects";
import { setRoomAnalyzingStatus } from "@/lib/firestore";
import { photoUploadSchema, type PhotoUploadFormData } from "@/schemas/roomSchemas";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, ImagePlus, Camera, Sparkles } from "lucide-react"; // Added Sparkles
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
    analyzedObjects?: Array<{ name: string; count: number }>, // Ensure this matches the flow output
    photoUrls?: string[]
  ) => void;
  currentPhotos: File[];
  onPhotosChange: (photos: File[]) => void;
}

const MAX_PHOTOS = 10;

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
  const analyzeButtonRef = useRef<HTMLButtonElement>(null); // Ref for the animated button

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<PhotoUploadFormData>({
    resolver: zodResolver(photoUploadSchema),
  });

  // Effect for animated button's mouse move
  useEffect(() => {
    const btn = analyzeButtonRef.current;
    if (!btn) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => { // Ensure globalThis.MouseEvent for clarity
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      btn.style.setProperty("--x", x + "px");
      btn.style.setProperty("--y", y + "px");
    };

    btn.addEventListener("mousemove", handleMouseMove);
    return () => {
      btn.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isAnalyzingLocal]); // Re-run if button might be re-rendered due to state change

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
    let aiAnalyzedObjects: Array<{ name: string; count: number }> | undefined = undefined;

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
      aiAnalyzedObjects = result.objects; // Ensure this matches the flow's output schema
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
        analysisSuccessful ? aiAnalyzedObjects : undefined, 
        analysisSuccessful ? uploadedImageUrls : []
      );
      hideAiLoader(); 
    }
  }

  return (
    <Card className="shadow-lg w-full">
      <CardHeader className="p-6">
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
            className={`space-y-6 p-6 drop-zone ${isDraggingOver ? 'drop-zone-active' : ''}`}
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
          <CardFooter className="p-6">
            <button 
              type="submit"
              ref={analyzeButtonRef}
              className="analyze-button-animated w-full"
              disabled={isAnalyzingLocal || currentPhotos.length === 0}
            >
              <div className="dots_border"></div>
              <Sparkles className="sparkle h-5 w-5" /> {/* Using Sparkles from lucide */}
              <span className="text_button">{isAnalyzingLocal ? "Analyzing..." : "Analyze Images"}</span>
            </button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
