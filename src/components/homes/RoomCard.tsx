
"use client";

import Link from "next/link";
import type { Room } from "@/types";
import { ArrowRight, CalendarDays, DoorOpen, Download, Edit, Loader2, Trash2 } from "lucide-react"; 
import { format } from "date-fns";
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
import { Button } from "@/components/ui/button"; 
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLoader } from "@/contexts/LoaderContext";


interface RoomCardProps {
  room: Room;
  homeId: string;
  homeName?: string;
  onRoomAction: () => void; // Renamed from onRoomDeleted / onRoomUpdated
}

export function RoomCard({ room, homeId, homeName, onRoomAction }: RoomCardProps) {
  const { toast } = useToast();
  const [_isDownloading, setIsDownloading] = _React.useState(false);
  const { showLoader, hideLoader } = useLoader();

  const handleDelete = async () => {
    showLoader();
    try {
      await deleteRoom(homeId, room.id);
      toast({
        title: "Room Deleted",
        description: `Room "${room.name}" has been deleted.`,
      });
      onRoomAction();
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
    if (!room.objectNames || room.objectNames.length === 0) {
      toast({
        title: "No Analysis Data",
        description: "This room has no analyzed objects to download.",
        variant: "default",
      });
      return;
    }
    setIsDownloading(true); // For local button state, global loader is separate
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
      room.objectNames.forEach((name, index) => {
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
        doc.text(`${index + 1}. ${name}`, 14, yPos);
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
  
  return (
    <Card className="flex flex-col bg-primary/10 text-foreground transition-all duration-300 ease-out hover:shadow-xl hover:shadow-primary/30 dark:hover:shadow-primary/50 hover:scale-[1.03] rounded-lg overflow-hidden">
      <CardHeader className="p-4 flex flex-row justify-between items-start">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-primary">
            <DoorOpen className="h-5 w-5" />
            {room.name}
          </CardTitle>
          {room.createdAt && (
            <CardDescription className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <CalendarDays className="h-3 w-3" />
              Added: {format(room.createdAt.toDate(), "MMM d, yyyy")}
            </CardDescription>
          )}
        </div>
        {room.objectNames && room.objectNames.length > 0 && !room.isAnalyzing && (
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleDownloadRoomPdf} 
            disabled={_isDownloading}
            className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary ml-2 shrink-0"
            aria-label="Download room analysis PDF"
          >
            {_isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        {room.isAnalyzing ? (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
          </p>
        ) : room.objectNames && room.objectNames.length > 0 ? (
          <p className="text-sm text-muted-foreground line-clamp-3"> 
            <span className="font-medium text-foreground">Last analysis:</span> {room.objectNames.join(', ').substring(0, 100)}{room.objectNames.join(', ').length > 100 ? '...' : ''}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground text-center italic py-2">No objects analyzed yet.</p>
        )}
      </CardContent>
      <CardFooter className="p-4 flex justify-between items-center border-t border-border/20">
        <div className="flex gap-2">
          <EditRoomDialog room={room} homeId={homeId} onRoomUpdated={onRoomAction} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive-outline" size="sm"> 
                <Trash2 className="h-4 w-4" /> 
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

    