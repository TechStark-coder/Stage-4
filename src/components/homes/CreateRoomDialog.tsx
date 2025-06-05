
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { addRoom } from "@/lib/firestore";
import { createRoomSchema, type CreateRoomFormData } from "@/schemas/roomSchemas";
import { DoorOpen, PlusCircle } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useLoader } from "@/contexts/LoaderContext";
import { useRouter } from "next/navigation"; // Import useRouter

interface CreateRoomDialogProps {
  homeId: string;
  onRoomCreated: () => void; // This can still be used for other purposes like refetching if needed elsewhere
}

export function CreateRoomDialog({ homeId, onRoomCreated }: CreateRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter(); // Initialize useRouter

  const form = useForm<CreateRoomFormData>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: "",
    },
  });

  async function onSubmit(data: CreateRoomFormData) {
    showLoader();
    try {
      const newRoomId = await addRoom(homeId, data); // Capture newRoomId
      toast({ title: "Room Created", description: `Room "${data.name}" has been successfully added.` });
      form.reset();
      onRoomCreated(); // Call original callback if needed
      setOpen(false);
      router.push(`/homes/${homeId}/rooms/${newRoomId}`); // Redirect to the new room's page
    } catch (error: any) {
      toast({ title: "Failed to Create Room", description: error.message, variant: "destructive" });
    } finally {
      hideLoader();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Room
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5" /> Add a New Room
          </DialogTitle>
          <DialogDescription>
            Enter a name for the new room in this home.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Living Room, Kitchen" {...field} />
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
                {form.formState.isSubmitting ? "Adding..." : "Add Room"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
