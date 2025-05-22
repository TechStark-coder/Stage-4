
"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Room } from "@/types";
import { ArrowRight, CalendarDays, DoorOpen, Trash2, Edit, Download, Loader2 } from "lucide-react"; 
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
import { deleteRoom } from "@/lib/firestore"; // Assuming this is just for Firestore room deletion
import { useToast } from "@/hooks/use-toast";
import { EditRoomDialog } from "./EditRoomDialog"; 
import { useLoader } from "@/contexts/LoaderContext";
import jsPDF from "jspdf";
import * as _React from 'react';


interface RoomCardProps {
  room: Room;
  homeId: string;
  homeName?: string; // Added for PDF naming
  onRoomDeleted: () => void;
  onRoomUpdated: () => void; 
}

export function RoomCard({ room, homeId, homeName, onRoomDeleted, onRoomUpdated }: RoomCardProps) {
  const { toast } = useToast();
  const { showLoader: showGlobalLoader, hideLoader: hideGlobalLoader } = useLoader(); // Renamed to avoid conflict
  const [isDownloading, setIsDownloading] = _React.useState(false);


  const handleDelete = async () => {
    showGlobalLoader();
    try {
      await deleteRoom(homeId, room.id);
      toast({
        title: "Room Deleted",
        description: `Room "${room.name}" has been deleted.`,
      });
      onRoomDeleted();
    } catch (error) {
      console.error("Error deleting room:", error)
      toast({
        title: "Error Deleting Room",
        description: "Could not delete the room. Please try again.",
        variant: "destructive",
      });
    } finally {
      hideGlobalLoader();
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
    setIsDownloading(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(`Object Analysis for: ${homeName ? homeName + " - " : ""}${room.name}`, 14, 22);
      
      doc.setFontSize(12);
      if (room.lastAnalyzedAt) {
        doc.text(`Analyzed on: ${format(room.lastAnalyzedAt.toDate(), "PPP 'at' p")}`, 14, 30);
      }

      doc.setFontSize(14);
      doc.text("Identified Objects:", 14, 45);
      
      let yPos = 55;
      room.objectNames.forEach((name, index) => {
        if (yPos > 270) { 
          doc.addPage();
          yPos = 20;
        }
        doc.text(`${index + 1}. ${name}`, 14, yPos);
        yPos += 10;
      });

      const fileName = `${(homeName ? homeName.replace(/ /g, "_") + "_" : "") + room.name.replace(/ /g, "_")}_analysis.pdf`;
      doc.save(fileName);
      toast({ title: "Download Started", description: `Downloading ${fileName}` });
    } catch (error) {
        console.error("Failed to generate PDF:", error);
        toast({title: "PDF Generation Failed", description: "Could not generate the PDF.", variant: "destructive"})
    } finally {
        setIsDownloading(false);
    }
  };
  
  return (
    <Card className="flex flex-col transition-all duration-300 ease-out hover:scale-105 hover:z-20 hover:shadow-2xl hover:shadow-primary/30 dark:hover:shadow-primary/50">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div className="flex-grow">
                <CardTitle className="flex items-center gap-2">
                <DoorOpen className="h-6 w-6 text-primary" />
                {room.name}
                </CardTitle>
                {room.createdAt && (
                <CardDescription className="flex items-center gap-1 text-xs mt-1">
                    <CalendarDays className="h-3 w-3" />
                    Added on {format(room.createdAt.toDate(), "PPP")}
                </CardDescription>
                )}
            </div>
            {room.objectNames && room.objectNames.length > 0 && !room.isAnalyzing && (
                 <button 
                    onClick={handleDownloadRoomPdf} 
                    disabled={isDownloading}
                    className="botao-download group" // Added group for potential future nested hover effects
                    aria-label="Download room analysis PDF"
                 >
                    {isDownloading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" />
                    ) : (
                        <>
                        <svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mysvg"><g id="SVGRepo_bgCarrier" strokeWidth="0">
                            </g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier">
                            <g id="Interface / Download"> 
                            <path id="Vector" d="M6 21H18M12 3V17M12 17L17 12M12 17L7 12" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            </path>
                            </g> </g>
                        </svg>
                        <span className="texto">Download</span>
                        </>
                    )}
                </button>
            )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow pt-2"> {/* Adjusted padding top */}
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
      <CardFooter className="flex justify-between items-center pt-4"> {/* Ensured padding top */}
        <div className="flex gap-2">
          <EditRoomDialog room={room} homeId={homeId} onRoomUpdated={onRoomUpdated} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive-outline" size="sm" className="text-destructive hover:bg-destructive/10 border-destructive/50 hover:border-destructive">
                <Trash2 className="h-4 w-4" />
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
        </div>
        <Button asChild variant="default" size="sm">
          <Link href={`/homes/${homeId}/rooms/${room.id}`}>
            Manage Room <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

    