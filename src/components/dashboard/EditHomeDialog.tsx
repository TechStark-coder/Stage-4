
"use client";

import { useState, useEffect, type ChangeEvent } from "react";
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
import { updateHome, removeHomeCoverImage } from "@/lib/firestore";
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
import { useAuthContext } from "@/hooks/useAuthContext";

interface EditHomeDialogProps {
  home: Home;
  onHomeUpdated: () => void;
}

export function EditHomeDialog({ home, onHomeUpdated }: EditHomeDialogProps) {
  const [open, setOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(home.coverImageUrl || null);
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoader();
  const { user } = useAuthContext();

  const form = useForm<HomeFormData>({
    resolver: zodResolver(homeFormSchema),
    defaultValues: {
      name: home.name,
      coverImage: undefined,
      // ownerDisplayName is not typically edited here, but could be added
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: home.name, coverImage: undefined });
      setImagePreview(home.coverImageUrl || null);
    }
  }, [open, home.name, home.coverImageUrl, form]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      form.setValue("coverImage", files);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      form.setValue("coverImage", undefined);
      setImagePreview(home.coverImageUrl || null); // Revert to original if selection is cleared
    }
  };

  async function onSubmit(data: HomeFormData) {
    if (!user) {
      toast({ title: "Error", description: "Authentication error.", variant: "destructive" });
      return;
    }
    showLoader();
    try {
      const homeUpdateData: UpdateHomeData = { name: data.name };
      const newCoverImageFile = data.coverImage && data.coverImage.length > 0 ? data.coverImage[0] : null;
      
      await updateHome(home.id, user.uid, homeUpdateData, newCoverImageFile);
      
      toast({ title: "Home Updated", description: `Home "${data.name}" has been successfully updated.` });
      onHomeUpdated();
      setOpen(false);
    } catch (error: any) {
      toast({ title: "Failed to Update Home", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      hideLoader();
    }
  }

  const handleRemoveCoverImage = async () => {
    if (!user) {
        toast({ title: "Error", description: "Authentication error.", variant: "destructive" });
        return;
    }
    showLoader();
    try {
      await removeHomeCoverImage(home.id);
      setImagePreview(null);
      form.setValue("coverImage", undefined); // Clear the file input in the form
      toast({ title: "Cover Image Removed", description: "The cover image has been removed." });
      onHomeUpdated(); // To refresh the card view immediately
    } catch (error: any) {
      console.error("Failed to remove cover image:", error)
      toast({ title: "Error", description: "Could not remove cover image: " + error.message, variant: "destructive"});
    } finally {
      hideLoader();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        form.reset({ name: home.name, coverImage: undefined });
        setImagePreview(home.coverImageUrl || null);
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
            Update the name or cover image for your home.
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
              render={() => ( 
                <FormItem>
                  <FormLabel>New Cover Image (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
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
            {!imagePreview && home.coverImageUrl && ( /* This case might not be hit if preview always shows original */
                <p className="text-sm text-muted-foreground text-center py-2">Cover image previously set.</p>
            )}
             {!imagePreview && !home.coverImageUrl && (
                <p className="text-sm text-muted-foreground text-center py-2">No cover image set.</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
