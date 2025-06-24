
"use client";

import Link from "next/link";
import type { Room } from "@/types";
import { ArrowRight, CalendarDays, DoorOpen, Loader2, Trash2, Download } from "lucide-react"; 
import * as _React from 'react';
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
import { EditRoomDialog } from "./EditRoomDialog";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLoader } from "@/contexts/LoaderContext";
import { useAuthContext } from "@/hooks/useAuthContext";


export interface RoomCardProps {
  room: Room;
  homeId: string;
  homeName?: string; 
  onRoomAction: () => void;
}

export function RoomCard({ room, homeId, homeName, onRoomAction }: RoomCardProps) {
  const { toast } = useToast();
  const [_isDownloading, setIsDownloading] = _React.useState(false);
  const { showLoader, hideLoader } = useLoader(); 
  const { user } = useAuthContext();

  const handleDelete = async () => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to delete a room.",
        variant: "destructive",
      });
      return;
    }
    showLoader();
    try {
      await deleteRoom(homeId, room.id, user.uid);
      toast({
        title: "Room Deleted",
        description: `Room "${room.name}" has been deleted.`,
      });
      if (typeof onRoomAction === 'function') {
        onRoomAction();
      }
    } catch (error: any) {
      console.error("Error deleting room:", error)
      toast({
        title: "Error Deleting Room",
        description: "Could not delete the room: " + error.message,
        variant: "destructive",
      });
    } finally {
      hideLoader();
    }
  };

  const handleDownloadRoomPdf = async () => {
    if (!room.analyzedObjects || room.analyzedObjects.length === 0) {
      toast({
        title: "No Analysis Data",
        description: "This room has no analyzed objects to download.",
        variant: "default",
      });
      return;
    }
    setIsDownloading(true); 
    showLoader(); 
    try {
      const doc = new jsPDF();
      const roomTitle = `${homeName ? homeName + " - " : ""}${room.name}`;
      doc.setFontSize(16);
      doc.text(roomTitle, 14, 22);

      doc.setFontSize(10);
      if (room.lastAnalyzedAt) {
        doc.text(`Analyzed on: ${format(room.lastAnalyzedAt.toDate(), "PPP 'at' p")}`, 14, 30);
      }

      doc.setFontSize(12);
      doc.text("Identified Objects:", 14, 45);

      let yPos = 55;
      doc.setFontSize(10);
      room.analyzedObjects.forEach((item, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
          doc.setFontSize(16);
          doc.text(`${roomTitle} (cont.)`, 14, yPos);
          yPos += 10;
          doc.setFontSize(12);
          doc.text("Identified Objects (cont.):", 14, yPos);
          yPos += 10;
          doc.setFontSize(10);
        }
        const countText = item.count > 1 ? ` (Count: ${item.count})` : "";
        doc.text(`${index + 1}. ${item.name}${countText}`, 14, yPos);
        yPos += 8;
      });

      const fileName = `${(homeName ? homeName.replace(/\s+/g, "_") + "_" : "") + room.name.replace(/\s+/g, "_")}_analysis.pdf`;
      doc.save(fileName);
      toast({ title: "Download Started", description: `Downloading ${fileName}` });
    } catch (error) {
        console.error("Failed to generate PDF:", error);
        toast({title: "PDF Generation Failed", description: "Could not generate the PDF.", variant: "destructive"})
    } finally {
        setIsDownloading(false);
        hideLoader();
    }
  };

  const canDownload = room.analyzedObjects && room.analyzedObjects.length > 0 && !room.isAnalyzing;

  return (
    <Card className="flex flex-col h-full transition-all duration-300 ease-out hover:shadow-2xl hover:shadow-primary/40 hover:scale-105 rounded-lg overflow-hidden bg-card">
      <CardHeader className="flex flex-row justify-between items-start p-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <DoorOpen className="h-5 w-5 text-primary" />
            {room.name}
          </CardTitle>
          {room.createdAt && (
            <CardDescription className="flex items-center gap-1 text-xs mt-1">
              <CalendarDays className="h-3 w-3" />
              Added: {format(room.createdAt.toDate(), "MMM d, yyyy")}
            </CardDescription>
          )}
        </div>
        {canDownload && (
           <button 
             onClick={handleDownloadRoomPdf} 
             disabled={_isDownloading}
             className="download-button-card"
             aria-label="Download room analysis PDF"
           >
             <svg className="svgIcon" viewBox="0 0 384 512" height="1em" xmlns="http://www.w3.org/2000/svg"><path d="M169.4 470.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 370.8 224 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 306.7L54.6 265.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"></path></svg>
             <span className="icon2"></span>
             <span className="tooltip">Download</span>
           </button>
        )}
      </CardHeader>

      <CardContent className="flex-grow p-4 pt-0">
        {room.isAnalyzing ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
          </div>
        ) : room.analyzedObjects && room.analyzedObjects.length > 0 ? (
          <p className="text-sm text-muted-foreground line-clamp-3">
            <span className="font-medium text-foreground">Last analysis:</span> {room.analyzedObjects.map(obj => `${obj.name}${obj.count > 1 ? ` (x${obj.count})` : ''}`).join(', ').substring(0, 100)}{room.analyzedObjects.map(obj => `${obj.name}${obj.count > 1 ? ` (x${obj.count})` : ''}`).join(', ').length > 100 ? '...' : ''}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic text-center py-2">No objects analyzed yet.</p>
        )}
      </CardContent>

      <CardFooter className="flex justify-between items-center p-4 border-t">
        <div className="flex gap-2">
          <EditRoomDialog room={room} homeId={homeId} onRoomUpdated={onRoomAction} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the room
                  "{room.name}" and all its associated data and images.
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
        </div>
        <Button asChild variant="default" size="sm">
          <Link href={`/homes/${homeId}/rooms/${room.id}`}>
            Manage <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
