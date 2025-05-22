
"use client";

import Link from "next/link";
import type { Room } from "@/types";
import { ArrowRight, CalendarDays, DoorOpen, Trash2, Download, Loader2 } from "lucide-react"; 
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
import { Button } from "@/components/ui/button"; // Standard ShadCN button for actions

interface RoomCardProps {
  room: Room;
  homeId: string;
  homeName?: string;
  onRoomDeleted: () => void;
  onRoomUpdated: () => void; 
}

export function RoomCard({ room, homeId, homeName, onRoomDeleted, onRoomUpdated }: RoomCardProps) {
  const { toast } = useToast();
  const [_isDownloading, setIsDownloading] = _React.useState(false);

  const handleDelete = async () => {
    // Consider adding a global loader here if not already handled by dialog/page
    try {
      await deleteRoom(homeId, room.id);
      toast({
        title: "Room Deleted",
        description: `Room "${room.name}" has been deleted.`,
      });
      if (typeof onRoomDeleted === 'function') {
        onRoomDeleted();
      }
    } catch (error) {
      console.error("Error deleting room:", error)
      toast({
        title: "Error Deleting Room",
        description: "Could not delete the room. Please try again.",
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
      doc.setFontSize(16); 
      doc.text(`${homeName ? homeName + " - " : ""}${room.name}`, 14, 22);
      
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
          doc.text(`${homeName ? homeName + " - " : ""}${room.name} (cont.)`, 14, yPos);
          yPos += 10;
          doc.setFontSize(12);
          doc.text("Identified Objects (cont.):", 14, yPos);
          yPos += 10;
          doc.setFontSize(10);
        }
        doc.text(`${index + 1}. ${name}`, 14, yPos);
        yPos += 8; 
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
    <div className="custom-3d-card-wrapper noselect">
      <div className="custom-3d-card-canvas">
        {/* 25 tracker divs for hover effect */}
        {Array.from({ length: 25 }, (_, i) => (
          <div key={`tracker-${room.id}-${i}`} className={`custom-3d-tracker tr-${i + 1}`}></div>
        ))}
        
        <div className="custom-3d-card-interactive-area p-3"> {/* Added padding and ensured this is the transformed element */}
          {/* Top section: Room Name, Date, Download Button */}
          <div className="flex justify-between items-start mb-2">
            <div className="flex-grow">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 truncate">
                <DoorOpen className="h-5 w-5 text-yellow-300 flex-shrink-0" /> {/* Adjusted icon color for new bg */}
                <span className="truncate" title={room.name}>{room.name}</span>
              </h3>
              {room.createdAt && (
                <p className="text-xs text-neutral-300 flex items-center gap-1 mt-1">
                  <CalendarDays className="h-3 w-3" />
                  Added: {format(room.createdAt.toDate(), "MMM d, yyyy")}
                </p>
              )}
            </div>
            {room.objectNames && room.objectNames.length > 0 && !room.isAnalyzing && (
               <button 
                  onClick={handleDownloadRoomPdf} 
                  disabled={_isDownloading}
                  className="botao-download group !p-1 !w-8 !h-8 !shadow-none !filter-none !bg-transparent hover:!w-8 hover:!h-8 hover:!rounded-md !text-white z-10 relative" // Added z-10 relative
                  aria-label="Download room analysis PDF"
               >
                  {_isDownloading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mysvg !block"><g id="SVGRepo_bgCarrier" strokeWidth="0">
                          </g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier">
                          <g id="Interface / Download"> 
                          <path id="Vector" d="M6 21H18M12 3V17M12 17L17 12M12 17L7 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          </path>
                          </g> </g>
                      </svg>
                      <span className="texto !hidden">Download</span>
                    </>
                  )}
              </button>
            )}
          </div>

          {/* Middle section: Analysis Preview */}
          <div className="flex-grow my-2 text-sm text-neutral-200 overflow-hidden">
            {room.isAnalyzing ? (
              <p className="flex items-center gap-1 text-xs text-yellow-200"> {/* Adjusted color */}
                <Loader2 className="h-3 w-3 animate-spin" /> Analyzing...
              </p>
            ) : room.objectNames && room.objectNames.length > 0 ? (
              <p className="line-clamp-3 text-xs"> 
                <span className="font-medium text-neutral-100">Last analysis:</span> {room.objectNames.join(', ').substring(0, 70)}{room.objectNames.join(', ').length > 70 ? '...' : ''}
              </p>
            ) : (
              <p className="text-center text-xs text-neutral-300 italic mt-4">No objects analyzed yet.</p>
            )}
          </div>

          {/* Bottom section: Action Buttons */}
          {/* This div needs z-index to be clickable */}
          <div className="mt-auto flex justify-between items-center border-t border-white/10 pt-2 relative z-10"> 
            <div className="flex gap-1"> 
              <EditRoomDialog room={room} homeId={homeId} onRoomUpdated={onRoomUpdated} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive-outline" size="sm" className="!text-red-400 hover:!bg-red-700/20 !border-red-500/50 hover:!border-red-500 !px-2 !py-1 !h-auto"> 
                    <Trash2 className="h-3 w-3" /> 
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
            <Button asChild variant="ghost" size="sm" className="text-yellow-300 hover:text-yellow-100 hover:bg-black/20 !px-2 !py-1 !h-auto !text-xs"> 
              <Link href={`/homes/${homeId}/rooms/${room.id}`}>
                Manage <ArrowRight className="ml-1 h-3 w-3" /> 
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
