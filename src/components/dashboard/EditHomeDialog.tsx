
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { updateHome } from "@/lib/firestore";
import { homeFormSchema, type HomeFormData } from "@/schemas/homeSchemas";
import { Pencil } from "lucide-react";
import type { Home, UpdateHomeData } from "@/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Image from "next/image";
import { useLoader } from "@/contexts/LoaderContext";

interface EditHomeDialogProps {
  home: Home;
  onHomeUpdated: () => void;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export function EditHomeDialog({ home, onHomeUpdated }: EditHomeDialogProps) {
  const [open, setOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoader();

  const form = useForm<HomeFormData>({
    resolver: zodResolver(homeFormSchema),
    defaultValues: {
      name: home.name,
      coverImage: undefined, 
      // ownerDisplayName is not part of HomeFormData by default, 
      // but homeFormSchema was updated to include it optionally.
      // For editing, we usually don't re-edit ownerDisplayName here, but if needed,
      // it could be added. For now, assuming it's not edited here.
    },
  });

  useEffect(() => {
    const existingImage = localStorage.getItem(`homeCover_${home.id}`);
    if (existingImage) {
      setImagePreview(existingImage);
    }
  }, [home.id, open]); 

  const coverImageWatch = form.watch("coverImage");

  useEffect(() => {
    if (coverImageWatch && coverImageWatch.length > 0) {
      const file = coverImageWatch[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (!form.formState.isDirty && open) { 
      const existingImage = localStorage.getItem(`homeCover_${home.id}`);
      if (existingImage) setImagePreview(existingImage);
      else setImagePreview(null);
    } 
  }, [coverImageWatch, home.id, open, form.formState.isDirty]);


  async function onSubmit(data: HomeFormData) {
    showLoader();
    try {
      const homeUpdateData: UpdateHomeData = { name: data.name };
      await updateHome(home.id, homeUpdateData);

      if (data.coverImage && data.coverImage.length > 0) {
        const imageFile = data.coverImage[0];
        try {
          const base64Image = await fileToBase64(imageFile);
          localStorage.setItem(`homeCover_${home.id}`, base64Image);
        } catch (error) {
          console.error("Failed to convert image to base64 or save to local storage:", error);
          toast({ title: "Image Warning", description: "Home updated, but new cover image could not be saved locally.", variant: "default" });
        }
      }
      
      toast({ title: "Home Updated", description: `Home "${data.name}" has been successfully updated.` });
      form.reset({ name: data.name, coverImage: undefined });
      onHomeUpdated();
      setOpen(false);
    } catch (error: any) {
      toast({ title: "Failed to Update Home", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      hideLoader();
    }
  }

  const handleRemoveCoverImage = () => {
    showLoader();
    try {
      localStorage.removeItem(`homeCover_${home.id}`);
      setImagePreview(null);
      form.setValue("coverImage", undefined); 
      toast({ title: "Cover Image Removed", description: "The cover image has been removed from local storage." });
    } catch (error) {
      toast({ title: "Error", description: "Could not remove cover image.", variant: "destructive"});
    } finally {
      hideLoader();
    }
  };


  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        form.reset({ name: home.name, coverImage: undefined });
        const existingImage = localStorage.getItem(`homeCover_${home.id}`);
        setImagePreview(existingImage || null); 
      } else {
        form.reset({ name: home.name, coverImage: undefined });
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-1 h-3 w-3" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Home</DialogTitle>
          <DialogDescription>
            Update the name or cover image for your home. Cover image is stored in your browser.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Home Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="coverImage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Cover Image (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => field.onChange(e.target.files)}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {imagePreview && (
              <div className="mt-2 space-y-2">
                <Label>Current Cover Image Preview:</Label>
                 <div className="relative w-full h-40 rounded-md overflow-hidden border">
                  <Image src={imagePreview} alt="Cover image preview" layout="fill" objectFit="cover" data-ai-hint="home preview"/>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleRemoveCoverImage} className="w-full">
                  Remove Cover Image
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setOpen(false);
                form.reset({ name: home.name, coverImage: undefined });
                 const existingImage = localStorage.getItem(`homeCover_${home.id}`);
                setImagePreview(existingImage || null);
              }}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
