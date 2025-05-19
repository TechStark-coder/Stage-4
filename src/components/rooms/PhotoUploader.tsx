
"use client";

import { useState, useRef } from "react";
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
  useForm,
} from "@/components/ui/form"; // Added useForm

interface PhotoUploaderProps {
  homeId: string;
  roomId: string;
  onAnalysisInitiated: () => void; // New prop
  onAnalysisComplete: () => void;  // Existing prop, now called when everything (AI + DB) is settled
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
  const [isAnalyzingLocal, setIsAnalyzingLocal] = useState(false); // For button's own disabled state
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PhotoUploadFormData>({
    resolver: zodResolver(photoUploadSchema),
    values: { photos: currentPhotos as any }, 
  });
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFilesArray = Array.from(files);
      onPhotosChange([...currentPhotos, ...newFilesArray]);
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

    setIsAnalyzingLocal(true); // Disable button immediately
    onAnalysisInitiated();     // Inform parent page that processing has started (for immediate UI feedback)

    try {
      await setRoomAnalyzingStatus(homeId, roomId, true); // Mark in DB that analysis is starting
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
      try { await setRoomAnalyzingStatus(homeId, roomId, false); } catch (e) {} // Best effort
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
      try {
        await setRoomAnalyzingStatus(homeId, roomId, false); // Ensure isAnalyzing is false on AI error
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
              name="photos" 
              render={() => (
                <FormItem>
                   <Input
                      id="photos-input"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      className="hidden"
                    />
                  <FormMessage />
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
