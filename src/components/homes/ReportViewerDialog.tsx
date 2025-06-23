"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { InspectionReport } from "@/types";
import { AlertTriangle, MessageSquareQuote } from "lucide-react";

interface ReportViewerDialogProps {
  report: InspectionReport | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ReportViewerDialog({ report, isOpen, onOpenChange }: ReportViewerDialogProps) {
  if (!report) {
    return null;
  }

  const inspectionDate = report.inspectionDate.toDate();
  const formattedDateIST = inspectionDate.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }) + ' (IST)';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Inspection Report</DialogTitle>
          <DialogDescription>
            Viewing report for <strong>{report.homeName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground py-2">
            <p><strong>Owner:</strong> {report.homeOwnerName}</p>
            <p><strong>Inspected By:</strong> {report.inspectedBy}</p>
            <p><strong>Date:</strong> {formattedDateIST}</p>
            <p><strong>Status:</strong> {report.overallStatus}</p>
        </div>
        <Separator />
        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-4">
            {report.rooms.map((room) => (
              <div key={room.roomId} className="p-3 border rounded-lg bg-background/50">
                <h4 className="font-semibold text-lg mb-2">{room.roomName}</h4>
                
                {room.tenantNotes && (
                    <div className="mb-3">
                        <h5 className="font-medium text-sm text-foreground flex items-center gap-2"><MessageSquareQuote className="h-4 w-4" /> Tenant's Note:</h5>
                        <p className="text-sm italic text-muted-foreground bg-muted/50 p-2 mt-1 rounded-md">"{room.tenantNotes}"</p>
                    </div>
                )}

                {room.discrepancies.length > 0 ? (
                  <div className="space-y-2">
                    <h5 className="font-medium text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Discrepancies Found:</h5>
                    <ul className="list-disc list-inside pl-2 space-y-1 text-sm text-destructive">
                      {room.discrepancies.map((d, index) => (
                        <li key={index}>
                          <strong>{d.name}:</strong> Expected {d.expectedCount}, Found {d.actualCount}. ({d.note})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                   <p className="text-sm text-muted-foreground">No discrepancies noted by AI for this room.</p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
