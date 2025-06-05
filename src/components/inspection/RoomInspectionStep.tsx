
"use client";

import * as React from 'react';
import type { Room, RoomInspectionReportData, InspectionDiscrepancy } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Added CardFooter
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Camera, CheckCircle, AlertTriangle, UploadCloud, Sparkles, ImagePlus, XCircle, RefreshCw } from 'lucide-react';
import type { FirebaseStorage } from 'firebase/storage';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import type { IdentifyDiscrepanciesInput, IdentifyDiscrepanciesOutput } from '@/ai/flows/identify-discrepancies-flow';
import type { useToast } from '@/hooks/use-toast';
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter as DialogModalFooter, // Aliased to avoid conflict with CardFooter if used
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";


interface RoomInspectionStepProps {
  homeId: string;
  room: Room;
  onInspectionStepComplete: (reportData: RoomInspectionReportData) => void;
  storage: FirebaseStorage;
  aiIdentifyDiscrepancies: (input: IdentifyDiscrepanciesInput) => Promise<IdentifyDiscrepanciesOutput>;
  toast: ReturnType<typeof useToast>['toast'];
}

const MAX_PHOTOS_PER_ROOM = 5;

// Helper function to convert File to Data URI
const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function RoomInspectionStep({
  homeId,
  room,
  onInspectionStepComplete,
  storage,
  aiIdentifyDiscrepancies,
  toast,
}: RoomInspectionStepProps) {
  const [photos, setPhotos] = React.useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = React.useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisResult, setAnalysisResult] = React.useState<IdentifyDiscrepanciesOutput | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [stepCompleted, setStepCompleted] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showCameraDialog, setShowCameraDialog] = React.useState(false);
  const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);


  React.useEffect(() => {
    // Reset state when room changes
    setPhotos([]);
    setPhotoPreviews([]);
    setIsAnalyzing(false);
    setAnalysisResult(null);
    setError(null);
    setStepCompleted(false);
  }, [room.id]);


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
    
    const totalAfterAdd = photos.length + filteredNewFiles.length;
    if (totalAfterAdd > MAX_PHOTOS_PER_ROOM) {
      toast({
        title: "Photo Limit Exceeded",
        description: `You can upload a maximum of ${MAX_PHOTOS_PER_ROOM} photos for this room. ${MAX_PHOTOS_PER_ROOM - photos.length} more can be added.`,
        variant: "destructive",
      });
      const remainingSlots = MAX_PHOTOS_PER_ROOM - photos.length;
      const filesToAdd = filteredNewFiles.slice(0, remainingSlots);
       if (filesToAdd.length > 0) {
        setPhotos(prev => [...prev, ...filesToAdd]);
        setPhotoPreviews(prev => [...prev, ...filesToAdd.map(f => URL.createObjectURL(f))]);
      }
    } else if (filteredNewFiles.length > 0) {
      setPhotos(prev => [...prev, ...filesToAdd]);
      setPhotoPreviews(prev => [...prev, ...filteredNewFiles.map(f => URL.createObjectURL(f))]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      addNewFiles(Array.from(files));
      if (event.target) event.target.value = ""; 
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== indexToRemove));
    setPhotoPreviews(prev => {
      const newPreviews = prev.filter((_,i) => i !== indexToRemove);
      if (photoPreviews[indexToRemove]) {
        URL.revokeObjectURL(photoPreviews[indexToRemove]);
      }
      return newPreviews;
    });
  };
  
  const openCamera = async () => {
    setHasCameraPermission(null);
    setCameraError(null);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setCameraStream(stream);
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err: any) {
        setHasCameraPermission(false);
        let message = "Could not access camera.";
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") message = "Camera permission denied. Please enable it in browser settings.";
        else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") message = "No camera found.";
        setCameraError(message);
        toast({ title: "Camera Error", description: message, variant: "destructive" });
      }
    } else {
      setCameraError("Camera access not supported by your browser.");
      toast({ title: "Unsupported Browser", description: "Camera access not supported by your browser.", variant: "destructive" });
    }
  };

  const closeCamera = () => {
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
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

  React.useEffect(() => {
    if (showCameraDialog) openCamera();
    return () => { 
      if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
      photoPreviews.forEach(url => URL.revokeObjectURL(url)); 
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCameraDialog]);


  const handleAnalyze = async () => {
    if (photos.length === 0) {
      toast({ title: "No Photos", description: "Please add or capture photos for the room.", variant: "destructive" });
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    let tenantPhotoDataUriForAI = "";
    let uploadedPhotoUrlsForReport: string[] = [];

    try {
      // 1. Convert the first photo to Data URI for AI analysis
      const firstPhotoFile = photos[0];
      tenantPhotoDataUriForAI = await fileToDataUri(firstPhotoFile);
      toast({ title: "Processing Photos...", description: `Preparing ${photos.length} photo(s) for ${room.name}.`, duration: 2000 });
      
      // 2. Attempt to upload all photos to Firebase Storage for record-keeping.
      try {
        toast({ title: "Saving Photos for Report...", description: `Attempting to save ${photos.length} photo(s) for the inspection record.`, duration: 3000 });
        for (const photo of photos) {
          const uniqueFileName = `inspection_${homeId}_${room.id}_${Date.now()}_${photo.name.replace(/\s+/g, '_')}`;
          const photoPath = `inspectionPhotos/${homeId}/${room.id}/${uniqueFileName}`;
          const sRef = storageRef(storage, photoPath);
          await uploadBytes(sRef, photo);
          const downloadURL = await getDownloadURL(sRef);
          uploadedPhotoUrlsForReport.push(downloadURL);
        }
        if (photos.length > 0 && uploadedPhotoUrlsForReport.length === photos.length) {
          toast({ title: "Report Photos Saved", description: "Tenant photos saved successfully for the record.", duration: 2000 });
        } else if (photos.length > 0 && uploadedPhotoUrlsForReport.length < photos.length) {
           toast({ title: "Partial Report Photo Save", description: "Some tenant photos could not be saved for the record due to an issue.", variant: "default", duration: 5000 });
        }
      } catch (uploadError: any) {
        console.warn(`Tenant photo upload failed for room ${room.name}:`, uploadError);
        const uploadErrorMessage = uploadError.message || "An unknown error occurred during photo upload.";
        const isPermissionError = uploadError.code === 'storage/unauthorized' || (typeof uploadErrorMessage === 'string' && uploadErrorMessage.includes('permission'));
        
        setError(`Failed to upload photos for ${room.name}. ${uploadErrorMessage}. Please check network and try again.`);
        toast({
          title: "Photo Upload Issue",
          description: isPermissionError 
            ? `Could not save tenant photos to the report due to a permission error. The AI analysis will still proceed using the first photo. Please contact the owner about storage permissions.`
            : `Could not save all tenant photos for the report: ${uploadErrorMessage}. AI analysis will still proceed.`,
          variant: "default", 
          duration: 8000,
        });
        // uploadedPhotoUrlsForReport will contain successfully uploaded URLs, or be empty.
      }

      // 3. Call AI with the Data URI of the first photo
      toast({ title: "AI Analysis Started", description: "Sending image to AI for discrepancy detection...", duration: 2000 });
      const aiInput: IdentifyDiscrepanciesInput = {
        tenantPhotoDataUri: tenantPhotoDataUriForAI,
        expectedItems: room.analyzedObjects || [], 
      };
      const result = await aiIdentifyDiscrepancies(aiInput);
      setAnalysisResult(result);
      
      const reportData: RoomInspectionReportData = {
        roomId: room.id,
        roomName: room.name,
        tenantPhotoUrls: uploadedPhotoUrlsForReport, // Store successfully uploaded URLs
        discrepancies: result.discrepancies,
        missingItemSuggestionForRoom: result.missingItemSuggestion,
      };
      onInspectionStepComplete(reportData);
      setStepCompleted(true);
      toast({ title: `Analysis for ${room.name} Complete!`, description: "Results below. Proceed to the next room or submit.", duration: 4000 });

    } catch (err: any) { 
      console.error(`Critical error during analysis for room ${room.name}:`, err);
      let errorMessage = "An unexpected error occurred during AI analysis.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      // Ensure the error shown to the user doesn't duplicate the photo upload error if that was the primary cause.
      if (!error || !error.startsWith("Failed to upload photos")) { 
        setError(`Failed to analyze photos for ${room.name}. ${errorMessage}. Please try again.`);
      }
      toast({ title: `Analysis Failed for ${room.name}`, description: errorMessage, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleRetry = () => {
    setPhotos([]);
    setPhotoPreviews([]);
    setIsAnalyzing(false);
    setAnalysisResult(null);
    setError(null);
    setStepCompleted(false);
  };


  return (
    <Card className="border-border/50 shadow-md bg-card/80 my-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Camera className="h-6 w-6 text-primary" />
          Inspecting: {room.name}
        </CardTitle>
        {!stepCompleted && <CardDescription>Upload up to {MAX_PHOTOS_PER_ROOM} photos of this room.</CardDescription>}
        {stepCompleted && <CardDescription className="text-green-500">This room's inspection is recorded. You can proceed.</CardDescription>}
      </CardHeader>

      {!stepCompleted && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing || photos.length >= MAX_PHOTOS_PER_ROOM}>
              <ImagePlus className="mr-2 h-4 w-4" /> Add Photos
            </Button>
            <Input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
              disabled={isAnalyzing || photos.length >= MAX_PHOTOS_PER_ROOM}
            />
             <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
                <DialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={isAnalyzing || photos.length >= MAX_PHOTOS_PER_ROOM}>
                        <Camera className="mr-2 h-4 w-4" /> Capture Live
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                    <DialogTitle>Capture Image for {room.name}</DialogTitle>
                    <DialogDescription>Position the camera and click "Snap Photo".</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                    <video ref={videoRef} autoPlay muted playsInline className="w-full aspect-video rounded-md bg-slate-900" />
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
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Requesting camera...
                        </div>
                    )}
                    </div>
                    <DialogModalFooter>
                      <Button variant="outline" onClick={closeCamera}>Cancel</Button>
                      <Button onClick={handleSnapPhoto} disabled={!cameraStream || hasCameraPermission === false || hasCameraPermission === null || photos.length >= MAX_PHOTOS_PER_ROOM}>
                          Snap Photo
                      </Button>
                    </DialogModalFooter>
                </DialogContent>
            </Dialog>
          </div>

          {photoPreviews.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Selected Photos ({photos.length}/{MAX_PHOTOS_PER_ROOM}):</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                {photoPreviews.map((previewUrl, index) => (
                  <div key={index} className="relative group aspect-square rounded-md overflow-hidden border border-border">
                    <Image src={previewUrl} alt={`Preview ${index + 1}`} layout="fill" objectFit="cover" data-ai-hint="room interior" />
                    {!isAnalyzing && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-destructive/90"
                        onClick={() => handleRemovePhoto(index)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || photos.length === 0 || stepCompleted}
            className="w-full"
          >
            {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isAnalyzing ? `Analyzing ${room.name}...` : `Analyze Photos for ${room.name}`}
          </Button>
        </CardContent>
      )}

      {error && !isAnalyzing && !stepCompleted && ( 
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Analysis Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
           <Button onClick={handleRetry} variant="outline" className="w-full mt-4">
             <RefreshCw className="mr-2 h-4 w-4" /> Retry Analysis for {room.name}
           </Button>
        </CardContent>
      )}
      
      
      {error && analysisResult && !isAnalyzing && error.startsWith("Failed to upload photos") && (
         <CardContent className="pt-0">
            <Alert variant="default" className="bg-amber-500/10 border-amber-500/50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700">Photo Upload Issue</AlertTitle>
                <AlertDescription className="text-amber-700">
                {error}
                </AlertDescription>
            </Alert>
         </CardContent>
      )}


      {analysisResult && !isAnalyzing && (
        <CardContent className="space-y-3 pt-4">
          <h3 className="text-md font-semibold text-foreground">Analysis Results for {room.name}:</h3>
          {analysisResult.missingItemSuggestion && (
            <Alert variant={analysisResult.discrepancies.length > 0 ? "default" : "default"} className={analysisResult.discrepancies.length > 0 ? "bg-amber-500/10 border-amber-500/50" : "bg-green-500/10 border-green-500/50"}>
              <Sparkles className={`h-4 w-4 ${analysisResult.discrepancies.length > 0 ? "text-amber-600" : "text-green-600" }`} />
              <AlertTitle>{analysisResult.discrepancies.length > 0 ? "Suggestion from AI" : "AI Note"}</AlertTitle>
              <AlertDescription className={analysisResult.discrepancies.length > 0 ? "text-amber-700" : "text-green-700"}>
                {analysisResult.missingItemSuggestion}
              </AlertDescription>
            </Alert>
          )}
          {analysisResult.discrepancies.length > 0 ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Potential Discrepancies Found:</p>
              <ul className="list-disc list-inside pl-4 text-sm bg-background/30 p-3 rounded-md border border-dashed">
                {analysisResult.discrepancies.map((d, i) => (
                  <li key={i} className="text-destructive-foreground">
                    <strong>{d.name}:</strong> Expected {d.expectedCount}, Found {d.actualCount}. ({d.note})
                  </li>
                ))}
              </ul>
            </div>
          ) : (
             !analysisResult.missingItemSuggestion.toLowerCase().includes("missing") && 
            <p className="text-sm text-green-600">No major discrepancies found based on the primary photo analysis.</p>
          )}
           {stepCompleted && !error && 
            <Button onClick={handleRetry} variant="outline" className="w-full mt-4">
                <RefreshCw className="mr-2 h-4 w-4" /> Re-inspect {room.name} (clears current photos)
            </Button>
           }
        </CardContent>
      )}
      {stepCompleted && (
         <CardFooter className="p-4">
            <div className="w-full flex items-center justify-center text-sm text-green-600 font-medium">
                <CheckCircle className="h-5 w-5 mr-2"/> {room.name} inspection step recorded.
            </div>
         </CardFooter>
      )}
    </Card>
  );
}
    

    