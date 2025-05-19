
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { describeRoomObjects, type DescribeRoomObjectsInput } from "@/ai/flows/describe-room-objects";
import { updateRoomObjectDescription, setRoomAnalyzingStatus } from "@/lib/firestore";
import { photoUploadSchema, type PhotoUploadFormData } from "@/schemas/roomSchemas";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, Wand2 } from "lucide-react";
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
  onAnalysisComplete: () => void;
}

export function PhotoUploader({ homeId, roomId, onAnalysisComplete }: PhotoUploaderProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzingLocal] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

  const form = useForm<PhotoUploadFormData>({
    resolver: zodResolver(photoUploadSchema),
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newPreviews: string[] = [];
      for (let i = 0; i < files.length; i++) {
        newPreviews.push(URL.createObjectURL(files[i]));
      }
      setPreviews(newPreviews);
      form.setValue("photos", files); // Update react-hook-form state
    } else {
      setPreviews([]);
      form.setValue("photos", new FileList());
    }
  };

  async function onSubmit(data: PhotoUploadFormData) {
    setIsAnalyzingLocal(true);
    await setRoomAnalyzingStatus(homeId, roomId, true); // Update Firestore status
    onAnalysisComplete(); // Optimistically update parent UI

    const photoDataUris: string[] = [];
    try {
      for (let i = 0; i < data.photos.length; i++) {
        const file = data.photos[i];
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

      await updateRoomObjectDescription(homeId, roomId, result.objectDescription);
      toast({
        title: "Analysis Complete",
        description: "Object description has been updated.",
      });
    } catch (error: any) {
      console.error("AI Analysis or Firestore update error:", error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze photos or save description.",
        variant: "destructive",
      });
      // If AI fails, set analyzing status back to false if it wasn't an optimistic update issue
      await setRoomAnalyzingStatus(homeId, roomId, false);
    } finally {
      setIsAnalyzingLocal(false);
      // Firestore status will be updated to false by updateRoomObjectDescription on success
      // or by the catch block on failure.
      onAnalysisComplete(); // Ensure parent UI reflects final state
      form.reset();
      setPreviews([]);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-primary" /> Upload Room Photos
        </CardTitle>
        <CardDescription>
          Upload one or more photos of the room. The AI will describe the objects it sees.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="photos"
              render={({ field }) => ( // field is not directly used here, onChange handled by custom handler
                <FormItem>
                  <Label htmlFor="photos-input" className="sr-only">Upload Photos</Label>
                  <FormControl>
                    <Input
                      id="photos-input"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {previews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                {previews.map((src, index) => (
                  <div key={index} className="relative aspect-square rounded-md overflow-hidden border">
                    <Image
                      src={src}
                      alt={`Preview ${index + 1}`}
                      layout="fill"
                      objectFit="cover"
                      data-ai-hint="room interior"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isAnalyzing || previews.length === 0}>
              <Wand2 className="mr-2 h-4 w-4" />
              {isAnalyzing ? "Analyzing..." : "Analyze Objects"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
