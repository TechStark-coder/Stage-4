
"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Pencil, Trash2 } from "lucide-react";
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
      address: home.address || "", // Use address, default to empty string if undefined
      coverImage: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: home.name,
        address: home.address || "", // Reset with address
        coverImage: undefined
      });
      setImagePreview(home.coverImageUrl || null);
    }
  }, [open, home, form]);

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
      setImagePreview(home.coverImageUrl || null);
    }
  };

  async function onSubmit(data: HomeFormData) {
    if (!user) {
      toast({ title: "Error", description: "Authentication error.", variant: "destructive" });
      return;
    }
    showLoader();
    try {
      const homeUpdateData: UpdateHomeData = {
        name: data.name,
        address: data.address === "" ? null : data.address, // Send null to clear, or the value for address
      };
      const newCoverImageFile = data.coverImage && data.coverImage.length > 0 ? data.coverImage[0] : null;

      await updateHome(home.id, user.uid, homeUpdateData, newCoverImageFile);

      toast({ title: "Home Updated", description: `Home "${data.name}" has been successfully updated.` });
      onHomeUpdated();
      setOpen(false);
    } catch (error: any) {
      console.error("Failed to update home:", error);
      const errorMessage = error.message || "An unexpected error occurred.";
      if (error.name === 'QuotaExceededError' || (typeof error.message === 'string' && error.message.includes("quota"))) {
        toast({
            title: "Image Too Large",
            description: "New cover image is too large to save. Home details updated without changing image.",
            variant: "destructive",
            duration: 7000,
         });
      } else {
        toast({ title: "Failed to Update Home", description: errorMessage, variant: "destructive" });
      }
    } finally {
      hideLoader();
    }
  }

  const handleRemoveCoverImageAndClearPreview = async () => {
    if (!user) {
        toast({ title: "Error", description: "Authentication error.", variant: "destructive" });
        return;
    }
    showLoader();
    try {
      await removeHomeCoverImage(home.id, user.uid); // Pass userId
      setImagePreview(null);
      form.setValue("coverImage", undefined);
      toast({ title: "Cover Image Removed", description: "The cover image has been removed." });
      onHomeUpdated();
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
        form.reset({ name: home.name, address: home.address || "", coverImage: undefined });
        setImagePreview(home.coverImageUrl || null);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1"> {/* Added flex-1 */}
          <Pencil className="mr-1 h-3 w-3" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Home</DialogTitle>
          <DialogDescription>
            Update the name, address, or cover image for your home.
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
              name="address" // Changed from description
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Update the address of the home"
                      className="resize-none"
                      {...field}
                      value={field.value ?? ""}
                    />
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
                  <Image src={imagePreview} alt="Cover image preview" layout="fill" objectFit="cover" data-ai-hint="home preview" />
                </div>
                <Button type="button" variant="destructive-outline" size="sm" onClick={handleRemoveCoverImageAndClearPreview} className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" /> Remove Cover Image
                </Button>
              </div>
            )}
             {!imagePreview && (
                <p className="text-sm text-muted-foreground text-center py-2">No cover image set. Upload one above.</p>
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
