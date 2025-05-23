"use client";

import Link from "next/link";
import type { Room } from "@/types";
import { ArrowRight, CalendarDays, DoorOpen, Download, Edit, Loader2, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button"; // Keep ShadCN Button for actions

export interface RoomCardProps {
  room: Room;
  homeId: string;
  homeName?: string; // To include in PDF title
  onRoomAction: () => void;
}

export function RoomCard({ room, homeId, homeName, onRoomAction }: RoomCardProps) {
  const { toast } = useToast();
  const [_isDownloading, setIsDownloading] = _React.useState(false);

  const handleDelete = async () => {
    // Assuming useLoader is available if we want a global loader for delete
    // For now, button will just be disabled
    try {
      await deleteRoom(homeId, room.id);
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
    }
  };

  const canDownload = room.objectNames && room.objectNames.length > 0 && !room.isAnalyzing;

  return (
    <div className="room-card-3d-wrapper noselect">
      <div className="room-card-3d-canvas">
        {Array.from({ length: 25 }, (_, i) => (
          <div key={`room-tracker-${room.id}-${i}`} className={`room-card-3d-tracker tr-${i + 1}`}></div>
        ))}
        <div className="room-card-3d-interactive-area p-4 flex flex-col justify-between">
          {/* Header Equivalent */}
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <DoorOpen className="h-5 w-5" />
                {room.name}
              </h3>
              {room.createdAt && (
                <p className="text-xs text-neutral-300 flex items-center gap-1 mt-1">
                  <CalendarDays className="h-3 w-3" />
                  Added: {format(room.createdAt.toDate(), "MMM d, yyyy")}
                </p>
              )}
            </div>
            {canDownload && (
               <Button
                variant="ghost"
                size="icon"
                onClick={handleDownloadRoomPdf}
                disabled={_isDownloading}
                className="text-white hover:bg-white/20 shrink-0"
                aria-label="Download room analysis PDF"
              >
                {_isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            )}
          </div>

          {/* Content Equivalent */}
          <div className="flex-grow my-3 text-sm">
            {room.isAnalyzing ? (
              <p className="text-neutral-300 flex items-center gap-1">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
              </p>
            ) : room.objectNames && room.objectNames.length > 0 ? (
              <p className="text-neutral-300 line-clamp-3">
                <span className="font-medium text-neutral-100">Last analysis:</span> {room.objectNames.join(', ').substring(0, 100)}{room.objectNames.join(', ').length > 100 ? '...' : ''}
              </p>
            ) : (
              <p className="text-neutral-300 text-center italic py-2">No objects analyzed yet.</p>
            )}
          </div>

          {/* Footer Equivalent - Buttons need high z-index */}
          <div className="flex justify-between items-center border-t border-white/20 pt-3 relative z-10">
            <div className="flex gap-2">
              <EditRoomDialog room={room} homeId={homeId} onRoomUpdated={onRoomAction} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-red-300 hover:bg-red-400/30 hover:text-red-200">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription className="text-[hsl(var(--muted-foreground))]">
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
            <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/20">
              <Link href={`/homes/${homeId}/rooms/${room.id}`}>
                Manage <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}