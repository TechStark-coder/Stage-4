
"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { describeRoomObjects, type DescribeRoomObjectsInput } from "@/ai/flows/describe-room-objects";
import { updateRoomObjectNames, setRoomAnalyzingStatus } from "@/lib/firestore";
import { photoUploadSchema, type PhotoUploadFormData } from "@/schemas/roomSchemas";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, Wand2, ImagePlus } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

interface PhotoUploaderProps {
  homeId: string;
  roomId: string;
  onAnalysisInitiated: () => void;
  onAnalysisComplete: (analysisSuccessful: boolean) => void; // Modified to accept success status
  currentPhotos: File[];
  onPhotosChange: (photos: File[]) => void;
}

export function PhotoUploader({
  homeId,
  roomId,
  onAnalysisInitiated,
  onAnalysisComplete,
  currentPhotos,
  onPhotosChange
}: PhotoUploaderProps) {
  const { toast } = useToast();
  const [isAnalyzingLocal, setIsAnalyzingLocal] = useState(false); // For disabling the button
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PhotoUploadFormData>({
    resolver: zodResolver(photoUploadSchema),
    // `values` prop for `useForm` is for default values.
    // `currentPhotos` prop will drive the UI for the image gallery directly.
    // We ensure the form schema checks `currentPhotos` length before submission.
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFilesArray = Array.from(files);
      const uniqueNewFiles = newFilesArray.filter(
        (newFile) => !currentPhotos.some((existingFile) => existingFile.name === newFile.name && existingFile.size === newFile.size)
      );
      onPhotosChange([...currentPhotos, ...uniqueNewFiles]);
      if (event.target) {
        event.target.value = ""; 
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  async function onSubmit() {
    if (currentPhotos.length === 0) {
      toast({
        title: "No Photos",
        description: "Please add photos before analyzing.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzingLocal(true);
    onAnalysisInitiated(); // Trigger global AI loader immediately

    let analysisSuccessful = false;
    try {
      await setRoomAnalyzingStatus(homeId, roomId, true);

      const photoDataUris: string[] = [];
      try {
        for (const file of currentPhotos) {
          const reader = new FileReader();
          const promise = new Promise<string>((resolve, reject) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
          });
          photoDataUris.push(await promise);
        }
      } catch (fileError) {
        console.error("Error processing photos:", fileError);
        toast({ title: "Photo Processing Error", description: "Could not read photo files.", variant: "destructive" });
        // Still need to set analyzing status to false if this specific part fails
        try { await setRoomAnalyzingStatus(homeId, roomId, false); } catch (e) { /* best effort */ }
        analysisSuccessful = false; // Explicitly mark as failed
        // The finally block will handle loader and button state
        return; // Exit early if photo processing fails
      }

      const aiInput: DescribeRoomObjectsInput = { photoDataUris };
      const result = await describeRoomObjects(aiInput);
      await updateRoomObjectNames(homeId, roomId, result.objectNames);
      toast({
        title: "Analysis Complete",
        description: "Object names have been updated.",
      });
      analysisSuccessful = true; 
      // Clearing photos from parent state (and thus sessionStorage) will be handled by onAnalysisComplete(true) in RoomDetailPage
      // onPhotosChange([]); // No longer call this directly here
    } catch (error: any) {
      console.error("AI Analysis or Firestore update error:", error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze photos or save description.",
        variant: "destructive",
      });
      analysisSuccessful = false;
      try {
        // Ensure isAnalyzing is set to false in Firestore if AI part fails
        await setRoomAnalyzingStatus(homeId, roomId, false);
      } catch (statusError) {
        console.error("Error setting analyzing status to false after AI failure:", statusError);
      }
    } finally {
      setIsAnalyzingLocal(false);
      onAnalysisComplete(analysisSuccessful); // Pass success status to parent
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-primary" /> Manage Room Photos
        </CardTitle>
        <CardDescription>
          Add photos of the room for analysis. You can remove them from the gallery.
        </CardDescription>
      </CardHeader>
      {/* Form is used for schema validation of currentPhotos.length before onSubmit */}
      <Form {...form}>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}> {/* Use onSubmit from component scope */}
          <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="photos" 
                // This field definition is mainly for react-hook-form to be aware of 'photos'
                // for validation purposes if we were to use form.handleSubmit.
                // Since we manually check currentPhotos.length, its direct control isn't critical here.
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
                    {/* Display form-level error messages if needed, though toast is primary feedback */}
                    <FormMessage /> 
                  </FormItem>
                )}
              />
              <Button type="button" onClick={triggerFileInput} variant="outline" className="w-full">
                  <ImagePlus className="mr-2 h-4 w-4" /> Add Photos
                </Button>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isAnalyzingLocal || currentPhotos.length === 0}>
              <Wand2 className="mr-2 h-4 w-4" />
              {isAnalyzingLocal ? "Analyzing..." : "Analyze Images"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

    