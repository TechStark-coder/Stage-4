
"use client";

import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { describeRoomObjects, type DescribeRoomObjectsInput } from "@/ai/flows/describe-room-objects";
import { updateRoomObjectNames, setRoomAnalyzingStatus } from "@/lib/firestore"; // updated function name
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
import type { Room } from "@/types";

interface PhotoUploaderProps {
  homeId: string;
  roomId: string;
  onAnalysisComplete: () => void;
  currentPhotos: File[];
  onPhotosChange: (photos: File[]) => void;
}

export function PhotoUploader({ homeId, roomId, onAnalysisComplete, currentPhotos, onPhotosChange }: PhotoUploaderProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzingLocal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PhotoUploadFormData>({
    resolver: zodResolver(photoUploadSchema),
    values: { photos: currentPhotos as any }, // Keep form in sync with parent state
  });
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFilesArray = Array.from(files);
      onPhotosChange([...currentPhotos, ...newFilesArray]);
      if (event.target) { // Reset file input to allow re-uploading the same file if removed then added
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
    await setRoomAnalyzingStatus(homeId, roomId, true);
    onAnalysisComplete(); // Optimistically update parent UI

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

      const aiInput: DescribeRoomObjectsInput = { photoDataUris };
      const result = await describeRoomObjects(aiInput);

      await updateRoomObjectNames(homeId, roomId, result.objectNames); // Use updated function
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
      await setRoomAnalyzingStatus(homeId, roomId, false);
    } finally {
      setIsAnalyzingLocal(false);
      onAnalysisComplete(); // Ensure parent UI reflects final state
      // Do not reset photos here, they are managed by parent
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-primary" /> Manage Room Photos
        </CardTitle>
        <CardDescription>
          Add photos of the room for analysis. You can remove them from the gallery below.
        </CardDescription>
      </CardHeader>
      <Form {...form}> {/* Form element is needed for react-hook-form, but onSubmit is handled by button */}
        <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="photos" 
              render={() => ( // field is not directly used for rendering input, but for validation
                <FormItem>
                   <Input
                      id="photos-input"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      className="hidden" // Hidden input, triggered by button
                    />
                  <FormMessage /> {/* Display validation errors for photos field */}
                </FormItem>
              )}
            />
             <Button type="button" onClick={triggerFileInput} variant="outline" className="w-full">
                <ImagePlus className="mr-2 h-4 w-4" /> Add Photos
              </Button>
        </CardContent>
        <CardFooter>
          <Button type="button" onClick={onSubmit} className="w-full" disabled={isAnalyzing || currentPhotos.length === 0}>
            <Wand2 className="mr-2 h-4 w-4" />
            {isAnalyzing ? "Analyzing..." : "Analyze Images"}
          </Button>
        </CardFooter>
      </Form>
    </Card>
  );
}
