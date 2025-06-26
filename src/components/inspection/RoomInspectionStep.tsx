"use client";

import * as React from 'react';
import type { Room, RoomInspectionReportData } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Camera, FileImage, CheckCircle, Info, AlertTriangle, X, Eye } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter as DialogModalFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { IdentifyDiscrepanciesInput, IdentifyDiscrepanciesOutput } from '@/ai/flows/identify-discrepancies-flow';
import { useAiAnalysisLoader } from "@/contexts/AiAnalysisLoaderContext";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ImageLightbox } from '@/components/rooms/ImageLightbox';

interface RoomInspectionStepProps {
  homeId: string;
  room: Room;
  onInspectionStepComplete: (reportData: RoomInspectionReportData) => void;
  aiIdentifyDiscrepancies: (input: IdentifyDiscrepanciesInput) => Promise<IdentifyDiscrepanciesOutput>;
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive"; duration?: number }) => void;
}

export function RoomInspectionStep({
  room,
  onInspectionStepComplete,
  aiIdentifyDiscrepancies,
  toast,
}: RoomInspectionStepProps) {
  const [tenantPhotos, setTenantPhotos] = React.useState<File[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [analysisResult, setAnalysisResult] = React.useState<IdentifyDiscrepanciesOutput | null>(null);
  const [analysisAttempted, setAnalysisAttempted] = React.useState(false);
  const { showAiLoader, hideAiLoader } = useAiAnalysisLoader();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showCameraDialog, setShowCameraDialog] = React.useState(false);
  const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [tenantNotes, setTenantNotes] = React.useState('');

  // State for owner's pictures lightbox
  const [isOwnerLightboxOpen, setIsOwnerLightboxOpen] = React.useState(false);
  const [ownerLightboxIndex, setOwnerLightboxIndex] = React.useState(0);

  React.useEffect(() => {
    // Reset state when room changes
    setTenantPhotos([]);
    setAnalysisResult(null);
    setAnalysisAttempted(false);
    setIsLoading(false);
    setTenantNotes('');
    setIsOwnerLightboxOpen(false); // also reset lightbox state
    console.log(`RoomInspectionStep: Switched to room: ${room.name} (ID: ${room.id})`);
  }, [room]);


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

    if (filteredNewFiles.length > 0) {
       setTenantPhotos(prev => [...prev, ...filteredNewFiles]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      addNewFiles(Array.from(files));
      if (event.target) event.target.value = "";
    }
  };

  const triggerFileInput = () => fileInputRef.current?.click();

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

  const handleSnapPhoto = () => {
    if (videoRef.current && canvasRef.current && cameraStream) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob) {
          addNewFiles([new File([blob], `capture_${Date.now()}.png`, { type: 'image/png' })]);
          closeCamera();
        } else {
          toast({ title: "Capture Failed", description: "Could not capture image.", variant: "destructive" });
        }
      }, 'image/png');
    }
  };

  React.useEffect(() => {
    if (showCameraDialog) openCamera();
    return () => { cameraStream?.getTracks().forEach(track => track.stop()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCameraDialog]);

  const handleAnalyze = async () => {
    if (tenantPhotos.length === 0) {
      toast({ title: "No Photos", description: "Please add or capture at least one photo for analysis.", variant: "destructive" });
      return;
    }
    if (!room.analyzedObjects || room.analyzedObjects.length === 0) {
      toast({ title: "Owner Data Missing", description: "No initial items list from owner for comparison. Cannot perform discrepancy check.", variant: "destructive" });
      setAnalysisAttempted(true);
      setAnalysisResult({ discrepancies: [], missingItemSuggestion: "Owner's initial list for this room was empty. Discrepancy check skipped." });
      return;
    }

    showAiLoader();
    setIsLoading(true);
    setAnalysisAttempted(true);

    try {
      const photoDataUris = await Promise.all(
        tenantPhotos.map(file => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
          });
        })
      );

      if (photoDataUris.length === 0) {
        throw new Error("Failed to prepare tenant photos for AI.");
      }

      const aiInput: IdentifyDiscrepanciesInput = {
        tenantPhotoDataUris: photoDataUris,
        expectedItems: room.analyzedObjects.map(obj => ({ name: obj.name, count: obj.count })),
      };

      toast({ title: "AI Analysis Started", description: `HomieStan AI is checking ${photoDataUris.length} photos...`, duration: 3000 });
      const result = await aiIdentifyDiscrepancies(aiInput);
      setAnalysisResult(result);
      
      if (result.discrepancies.length > 0) {
        toast({ title: "Analysis Complete", description: "Discrepancies were found. You can re-analyze with new photos or confirm.", variant: "destructive", duration: 6000 });
      } else {
        toast({ title: "Analysis Complete", description: "No discrepancies found!", duration: 5000 });
      }

    } catch (error: any) {
      console.error("Error during AI Analysis:", error);
      toast({
        title: "AI Analysis Error",
        description: error.message || "Could not get AI discrepancy report.",
        variant: "destructive",
      });
      setAnalysisResult(null);
    } finally {
      setIsLoading(false);
      hideAiLoader();
    }
  };

  const handleCompleteStep = () => {
    const reportData: RoomInspectionReportData = {
      roomId: room.id,
      roomName: room.name,
      tenantPhotoUrls: [], // This is handled server-side now
      expectedItems: room.analyzedObjects || [],
      discrepancies: analysisResult?.discrepancies || [],
      missingItemSuggestionForRoom: analysisResult?.missingItemSuggestion || "",
      tenantNotes: tenantNotes,
    };
    onInspectionStepComplete(reportData);
    toast({ title: `Report for ${room.name} Saved`, description: "Proceed to the next room or complete inspection.", duration: 3000});
  };

  // Lightbox handlers for owner pictures
  const handleShowOwnerPictures = () => {
    if (room.analyzedPhotoUrls && room.analyzedPhotoUrls.length > 0) {
      setOwnerLightboxIndex(0);
      setIsOwnerLightboxOpen(true);
    } else {
      toast({ title: "No Owner Photos", description: "The owner did not provide reference photos for this room.", variant: "default" });
    }
  };

  const handleCloseOwnerLightbox = () => {
    setIsOwnerLightboxOpen(false);
  };
  
  const handleNavigateOwnerLightbox = (newIndex: number) => {
    if (room.analyzedPhotoUrls && newIndex >= 0 && newIndex < room.analyzedPhotoUrls.length) {
      setOwnerLightboxIndex(newIndex);
    }
  };

  return (
    <>
      <Card className="w-full shadow-xl my-6 bg-card/90">
        <CardHeader>
          <CardTitle>Inspecting: {room.name}</CardTitle>
          <div className="flex justify-between items-start flex-wrap gap-2">
            <CardDescription className="flex-1 min-w-[200px]">
              Provide photos of the room as it currently is. The AI will compare these with the owner's initial list.
            </CardDescription>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleShowOwnerPictures}
              disabled={!room.analyzedPhotoUrls || room.analyzedPhotoUrls.length === 0}
            >
              <Eye className="mr-2 h-4 w-4" /> Show Owner's Pictures
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-muted-foreground">
              Your Photos for {room.name} ({tenantPhotos.length} photo(s)):
            </label>
            <div className="flex flex-wrap gap-2">
              {tenantPhotos.map((file, index) => (
                <div key={index} className="relative w-20 h-20">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Tenant photo ${index + 1}`}
                    className="w-full h-full object-cover rounded-md border"
                    onLoad={e => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0.5"
                    onClick={() => setTenantPhotos(prev => prev.filter((_, i) => i !== index))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input
                id={`file-input-${room.id}`}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
              />
              <Button type="button" variant="outline" onClick={triggerFileInput} disabled={isLoading}>
                <FileImage className="mr-2 h-4 w-4" /> Add File(s)
              </Button>
              <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" disabled={isLoading}>
                    <Camera className="mr-2 h-4 w-4" /> Use Camera
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Capture Image</DialogTitle>
                    <DialogDescription>Position the camera and click "Snap Photo".</DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <video ref={videoRef} autoPlay muted playsInline className="w-full aspect-video rounded-md bg-black" />
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
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Requesting camera access...
                      </div>
                    )}
                  </div>
                  <DialogModalFooter className="gap-2 sm:gap-0 flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                    <Button variant="outline" onClick={closeCamera}>Cancel</Button>
                    <Button onClick={handleSnapPhoto} disabled={!cameraStream || hasCameraPermission === false || hasCameraPermission === null}>Snap Photo</Button>
                  </DialogModalFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="mt-4">
              <Button onClick={handleAnalyze} disabled={isLoading || tenantPhotos.length === 0}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  {analysisAttempted ? 'Re-analyze Photos' : 'Analyze My Photos'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`tenant-notes-${room.id}`}>Notes for Owner (Optional)</Label>
            <Textarea
              id={`tenant-notes-${room.id}`}
              placeholder={`e.g., "Last week the care taker moved the things out of home."`}
              value={tenantNotes}
              onChange={(e) => setTenantNotes(e.target.value)}
              className="bg-background"
              rows={3}
              disabled={isLoading}
            />
          </div>

          {analysisAttempted && !isLoading && (
            <div className="space-y-4 pt-4 border-t mt-4">
              <h3 className="text-lg font-semibold">Inspection Results</h3>
              {analysisResult ? (
                  <>
                      {analysisResult.discrepancies.length > 0 ? (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Discrepancies Found</AlertTitle>
                          <AlertDescription>
                            <p className="mb-2">The AI identified the following issues:</p>
                            <ul className="list-disc list-inside pl-2 space-y-1 text-sm">
                              {analysisResult.discrepancies.map((item, index) => (
                                <li key={index}>
                                  <strong>{item.name}:</strong> Found {item.actualCount} of {item.expectedCount} expected.
                                </li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Alert variant="default" className="border-green-500 bg-green-500/10">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertTitle className="text-green-700">All Clear!</AlertTitle>
                          <AlertDescription className="text-green-700">
                            No issues identified by AI. You can now confirm and save.
                          </AlertDescription>
                        </Alert>
                      )}
                  </>
              ) : (
                  <p className="text-sm text-muted-foreground">
                      AI analysis could not be completed, or the owner's initial list for this room was empty.
                  </p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t pt-4 flex flex-col sm:flex-row justify-end items-center gap-4">
          <Button 
              onClick={handleCompleteStep} 
              disabled={isLoading || !analysisAttempted}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
          >
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirm & Save for {room.name}
          </Button>
        </CardFooter>
      </Card>
      
      {/* Lightbox for Owner's Pictures */}
      <ImageLightbox
        images={room.analyzedPhotoUrls || []}
        currentIndex={ownerLightboxIndex}
        isOpen={isOwnerLightboxOpen}
        onClose={handleCloseOwnerLightbox}
        onNavigate={handleNavigateOwnerLightbox}
      />
    </>
  );
}
