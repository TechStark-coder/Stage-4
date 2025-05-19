
"use client";

import { useState } from "react";
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
  DialogTrigger, // Added DialogTrigger here
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { addHome } from "@/lib/firestore";
import { useAuthContext } from "@/hooks/useAuthContext";
import { createHomeSchema, type CreateHomeFormData } from "@/schemas/homeSchemas";
import { HousePlus, PlusCircle } from "lucide-react"; 
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface CreateHomeDialogProps {
  onHomeCreated: () => void;
}

export function CreateHomeDialog({ onHomeCreated }: CreateHomeDialogProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuthContext();
  const { toast } = useToast();
  const form = useForm<CreateHomeFormData>({
    resolver: zodResolver(createHomeSchema),
    defaultValues: {
      name: "",
    },
  });

  async function onSubmit(data: CreateHomeFormData) {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to create a home.", variant: "destructive" });
      return;
    }
    try {
      await addHome(user.uid, data);
      toast({ title: "Home Created", description: `Home "${data.name}" has been successfully created.` });
      form.reset();
      onHomeCreated();
      setOpen(false);
    } catch (error: any) {
      toast({ title: "Failed to Create Home", description: error.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Enter a name for your new home. You can add rooms to it later.
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
