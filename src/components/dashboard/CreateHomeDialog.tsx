
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createHomeSchema, type CreateHomeFormData } from "@/schemas/homeSchemas";
import { HousePlus, PlusCircle, ImageUp } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Image from "next/image";

interface CreateHomeDialogProps {
  onHomeCreated: () => void;
}

export function CreateHomeDialog({ onHomeCreated }: CreateHomeDialogProps) {
  const [open, setOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { user } = useAuthContext();
  const { toast } = useToast();
  
  const form = useForm<CreateHomeFormData>({
    resolver: zodResolver(createHomeSchema),
    defaultValues: {
      name: "",
      coverImage: null,
    },
  });

  const coverImageRef = form.register("coverImage");

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "coverImage") {
        const files = value.coverImage;
        if (files && files.length > 0) {
          const file = files[0];
          setImagePreview(URL.createObjectURL(file));
        } else {
          setImagePreview(null);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch, form]);

  async function onSubmit(data: CreateHomeFormData) {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to create a home.", variant: "destructive" });
      return;
    }
    try {
      const homeData: CreateHomeData = { name: data.name };
      if (data.coverImage && data.coverImage.length > 0) {
        homeData.coverImage = data.coverImage[0];
      }
      
      await addHome(user.uid, homeData);
      toast({ title: "Home Created", description: `Home "${data.name}" has been successfully created.` });
      form.reset();
      setImagePreview(null);
      onHomeCreated();
      setOpen(false);
    } catch (error: any) {
      console.error("Failed to create home:", error);
      toast({ title: "Failed to Create Home", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        form.reset();
        setImagePreview(null);
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
            Enter a name and optionally upload a cover image for your new home.
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
              name="coverImage"
              render={() => ( // field is not directly used here
                <FormItem>
                  <FormLabel>Cover Image (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      accept="image/jpeg,image/png,image/webp" 
                      {...coverImageRef}
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
                  <Image src={imagePreview} alt="Cover image preview" layout="fill" objectFit="cover" />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setOpen(false);
                form.reset();
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
