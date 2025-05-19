
"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form"; // Import useForm directly from react-hook-form
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
  onAnalysisComplete: () => void;
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
  const [isAnalyzingLocal, setIsAnalyzingLocal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PhotoUploadFormData>({
    resolver: zodResolver(photoUploadSchema),
    values: { photos: currentPhotos as any }, // Keep values in sync with prop
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFilesArray = Array.from(files);
      // Prevent duplicates if the same file is selected again
      const uniqueNewFiles = newFilesArray.filter(
        (newFile) => !currentPhotos.some((existingFile) => existingFile.name === newFile.name && existingFile.size === newFile.size)
      );
      onPhotosChange([...currentPhotos, ...uniqueNewFiles]);
      if (event.target) {
        event.target.value = ""; // Reset file input to allow selecting the same file again if removed
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

    setIsAnalyzingLocal(true); // Disable button immediately
    

    try {
      await setRoomAnalyzingStatus(homeId, roomId, true); // Mark in DB that analysis is starting
      onAnalysisInitiated();     // Inform parent page that processing has started
    } catch (statusError) {
      console.error("Failed to set room analyzing status to true:", statusError);
      toast({ title: "Error", description: "Could not initiate analysis process.", variant: "destructive" });
      setIsAnalyzingLocal(false);
      onAnalysisComplete(); // Inform parent that the attempt is over
      return;
    }

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
      setIsAnalyzingLocal(false);
      try { await setRoomAnalyzingStatus(homeId, roomId, false); } catch (e) { /* best effort */ }
      onAnalysisComplete();
      return;
    }

    try {
      const aiInput: DescribeRoomObjectsInput = { photoDataUris };
      const result = await describeRoomObjects(aiInput);
      await updateRoomObjectNames(homeId, roomId, result.objectNames);
      toast({
        title: "Analysis Complete",
        description: "Object names have been updated.",
      });
    } catch (error: any) {
      console.error("AI Analysis or Firestore update error:", error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze photos or save description.",
        variant: "destructive",
      });
      // Ensure isAnalyzing is false on AI error, but do this before onAnalysisComplete
      try {
        await setRoomAnalyzingStatus(homeId, roomId, false);
      } catch (statusError) {
        console.error("Error setting analyzing status to false after AI failure:", statusError);
      }
    } finally {
      setIsAnalyzingLocal(false); // Re-enable button
      onAnalysisComplete();     // Inform parent page the whole process (AI+DB) is finished
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
      <Form {...form}>
        <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="photos" // This field is mainly for schema validation trigger, actual files managed by currentPhotos prop
              render={() => (
                <FormItem>
                   <Input
                      id="photos-input"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif" // Added more common image types
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      className="hidden" // Keep input hidden, triggered by button
                    />
                  <FormMessage /> {/* For displaying validation errors from schema if any */}
                </FormItem>
              )}
            />
             <Button type="button" onClick={triggerFileInput} variant="outline" className="w-full">
                <ImagePlus className="mr-2 h-4 w-4" /> Add Photos
              </Button>
        </CardContent>
        <CardFooter>
          <Button type="button" onClick={onSubmit} className="w-full" disabled={isAnalyzingLocal || currentPhotos.length === 0}>
            <Wand2 className="mr-2 h-4 w-4" />
            {isAnalyzingLocal ? "Analyzing..." : "Analyze Images"}
          </Button>
        </CardFooter>
      </Form>
    </Card>
  );
}
