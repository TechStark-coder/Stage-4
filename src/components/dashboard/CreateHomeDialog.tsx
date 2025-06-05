
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
import { addHome } from "@/lib/firestore";
import { useAuthContext } from "@/hooks/useAuthContext";
import { homeFormSchema, type HomeFormData } from "@/schemas/homeSchemas";
import { HousePlus, PlusCircle } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Image from "next/image";
import type { CreateHomeData } from "@/types";
import { updateProfile } from "firebase/auth";
import { auth } from "@/config/firebase";
import { useLoader } from "@/contexts/LoaderContext";
import { useRouter } from "next/navigation"; // Import useRouter

interface CreateHomeDialogProps {
  onHomeCreated: () => void; // This can still be used for other purposes like refetching if needed elsewhere
}

export function CreateHomeDialog({ onHomeCreated }: CreateHomeDialogProps) {
  const [open, setOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { user } = useAuthContext();
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter(); // Initialize useRouter

  const form = useForm<HomeFormData>({
    resolver: zodResolver(homeFormSchema),
    defaultValues: {
      name: "",
      ownerDisplayName:  "",
      address: "", // Updated from description
      coverImage: undefined,
    },
  });

  useEffect(() => {
    if (user && open) {
      form.setValue("ownerDisplayName", user.displayName || "");
    }
  }, [open, user, form]);

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
      setImagePreview(null);
    }
  };

  async function onSubmit(data: HomeFormData) {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to create a home.", variant: "destructive" });
      return;
    }
    showLoader();
    try {
      if (auth.currentUser && data.ownerDisplayName && data.ownerDisplayName !== user.displayName) {
        await updateProfile(auth.currentUser, { displayName: data.ownerDisplayName });
      }

      const homeDataToSubmit: CreateHomeData = { 
        name: data.name,
        address: data.address || "", // Updated from description
      };
      const coverImageFile = data.coverImage && data.coverImage.length > 0 ? data.coverImage[0] : null;
      
      const newHomeId = await addHome(user.uid, homeDataToSubmit, coverImageFile); // Capture newHomeId

      toast({ title: "Home Created", description: `Home "${data.name}" has been successfully created.` });
      form.reset({ name: "", ownerDisplayName: data.ownerDisplayName || user.displayName || "", address: "", coverImage: undefined });
      setImagePreview(null);
      onHomeCreated(); // Call original callback if needed
      setOpen(false);
      router.push(`/homes/${newHomeId}`); // Redirect to the new home's page
    } catch (error: any) {
      console.error("Failed to create home:", error);
      const errorMessage = error.message || "An unexpected error occurred.";
      if (error.name === 'QuotaExceededError' || (typeof error.message === 'string' && error.message.includes("quota"))) {
        toast({ 
          title: "Image Too Large", 
          description: "Cover image is too large to save. Home created without it.", 
          variant: "destructive",
          duration: 7000,
        });
      } else {
        toast({ title: "Failed to Create Home", description: errorMessage, variant: "destructive" });
      }
    } finally {
      hideLoader();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        form.reset({ name: "", ownerDisplayName: user?.displayName || "", address: "", coverImage: undefined });
        setImagePreview(null);
      } else if (user) {
        form.setValue("ownerDisplayName", user.displayName || "");
      }
    }}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Home
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HousePlus className="h-5 w-5" /> Create a New Home
          </DialogTitle>
          <DialogDescription>
            Enter details for your new home. The cover image will be uploaded.
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
                    <Input placeholder="e.g., My Summer House" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="address" // Updated from description
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the full address of the home"
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
              name="ownerDisplayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name (for welcome message)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Asif Khan" {...field} />
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
                  <FormLabel>Cover Image (Optional)</FormLabel>
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
                <Label>Image Preview:</Label>
                <div className="relative w-full h-40 rounded-md overflow-hidden border">
                  <Image src={imagePreview} alt="Cover image preview" layout="fill" objectFit="cover" data-ai-hint="home preview"/>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setOpen(false);
                form.reset({ name: "", ownerDisplayName: user?.displayName || "", address: "", coverImage: undefined });
                setImagePreview(null);
              }}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating..." : "Create Home"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
