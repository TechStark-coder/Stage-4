
"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Room } from "@/types";
import { ArrowRight, CalendarDays, DoorOpen, Trash2, Loader2 } from "lucide-react"; // Changed Wand2 to Loader2
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteRoom } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";

interface RoomCardProps {
  room: Room;
  homeId: string;
  onRoomDeleted: () => void;
}

export function RoomCard({ room, homeId, onRoomDeleted }: RoomCardProps) {
  const { toast } = useToast();

  const handleDelete = async () => {
    try {
      await deleteRoom(homeId, room.id);
      toast({
        title: "Room Deleted",
        description: `Room "${room.name}" has been deleted.`,
      });
      onRoomDeleted();
    } catch (error) {
      toast({
        title: "Error Deleting Room",
        description: "Could not delete the room. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Card className="flex flex-col transition-all duration-300 ease-in-out hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] dark:hover:shadow-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DoorOpen className="h-6 w-6 text-primary" />
          {room.name}
        </CardTitle>
        {room.createdAt && (
          <CardDescription className="flex items-center gap-1 text-xs">
            <CalendarDays className="h-3 w-3" />
            Added on {format(room.createdAt.toDate(), "PPP")}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-grow">
        {room.isAnalyzing ? (
          <p className="text-sm text-accent-foreground mt-2 flex items-center gap-1">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing photos...
          </p>
        ) : room.objectNames && room.objectNames.length > 0 ? (
          <p className="text-sm text-muted-foreground line-clamp-3">
            <span className="font-medium text-foreground">Last analysis:</span> {room.objectNames.join(', ').substring(0, 100)}{room.objectNames.join(', ').length > 100 ? '...' : ''}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No objects analyzed yet. Upload photos to describe this room.
          </p>
        )}
      </CardContent>
      <CardFooter className="flex justify-between items-center">
         <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive-outline" size="sm" className="text-destructive hover:bg-destructive/10 border-destructive/50 hover:border-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the room
                "{room.name}" and all its associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Yes, delete room
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button asChild variant="default" size="sm">
          <Link href={`/homes/${homeId}/rooms/${room.id}`}>
            Manage Room <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
