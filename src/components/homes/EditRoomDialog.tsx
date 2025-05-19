
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
import { updateRoom } from "@/lib/firestore";
import { createRoomSchema, type CreateRoomFormData } from "@/schemas/roomSchemas"; 
import type { Room, UpdateRoomData } from "@/types";
import { Pencil } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useLoader } from "@/contexts/LoaderContext";


interface EditRoomDialogProps {
  room: Room;
  homeId: string;
  onRoomUpdated: () => void;
}

export function EditRoomDialog({ room, homeId, onRoomUpdated }: EditRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoader();

  const form = useForm<CreateRoomFormData>({ 
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: room.name,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: room.name });
    }
  }, [open, room, form]);

  async function onSubmit(data: CreateRoomFormData) {
    showLoader();
    console.log("Attempting to update room. Home ID:", homeId, "Room ID:", room.id, "New Data:", data);
    try {
      const roomUpdateData: UpdateRoomData = { name: data.name };
      await updateRoom(homeId, room.id, roomUpdateData);
      toast({ title: "Room Updated", description: `Room "${data.name}" has been successfully updated.` });
      
      if (typeof onRoomUpdated === 'function') {
        onRoomUpdated();
      } else {
        console.error("onRoomUpdated is not a function in EditRoomDialog. Received:", onRoomUpdated);
      }
      
      setOpen(false);
    } catch (error: any) {
      console.error("Failed to update room:", error);
      toast({ title: "Failed to Update Room", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      hideLoader();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-1 h-3 w-3" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Room</DialogTitle>
          <DialogDescription>
            Update the name for your room.
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
                    <Input {...field} />
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
                {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
