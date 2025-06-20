
"use client";

import * as React from "react";
import jsPDF from 'jspdf';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getInspectionReportsForHome } from "@/lib/firestore";
import type { InspectionReport } from "@/types";
import { History, FileDown, Loader2, Info } from "lucide-react";

interface InspectionHistoryDialogProps {
  homeId: string;
  homeName: string;
  homeOwnerName: string;
  currentUserId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function InspectionHistoryDialog({
  homeId,
  homeName,
  homeOwnerName,
  currentUserId,
  isOpen,
  onOpenChange,
}: InspectionHistoryDialogProps) {
  const [reports, setReports] = React.useState<InspectionReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [downloadingReportId, setDownloadingReportId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && homeId && currentUserId) {
      setLoading(true);
      getInspectionReportsForHome(homeId, currentUserId)
        .then(setReports)
        .catch(err => {
          console.error("Failed to fetch inspection history:", err);
          setReports([]);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, homeId, currentUserId]);

  const generatePdfDocument = async (reportDetails: InspectionReport): Promise<jsPDF> => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    let yPos = 20;
    const lineHeight = 7;
    const margin = 15;
    const maxLineWidth = doc.internal.pageSize.width - margin * 2;

    const checkAndAddPage = (neededHeight: number) => {
      if (yPos + neededHeight > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
    };

    doc.setFontSize(18);
    doc.text(`Inspection Report: ${reportDetails.homeName}`, margin, yPos);
    yPos += lineHeight * 2;

    doc.setFontSize(12);
    doc.text(`Owner: ${reportDetails.homeOwnerName || 'N/A'}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Inspected By: ${reportDetails.inspectedBy}`, margin, yPos);
    yPos += lineHeight;

    const inspectionDate = reportDetails.inspectionDate.toDate();
    const formattedDateIST = inspectionDate.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }) + ' (IST)';
    doc.text(`Date: ${formattedDateIST}`, margin, yPos);
    yPos += lineHeight * 1.5;

    doc.setFontSize(14);
    doc.text("Room Details & Findings:", margin, yPos);
    yPos += lineHeight * 1.5;

    reportDetails.rooms.forEach(room => {
      checkAndAddPage(lineHeight * 4);
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Room: ${room.roomName}`, margin, yPos);
      doc.setFont(undefined, 'normal');
      yPos += lineHeight;

      if (room.missingItemSuggestionForRoom) {
        // ... (existing logic for suggestion)
      }

      if (room.discrepancies.length > 0) {
        checkAndAddPage(lineHeight * 2);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text("Discrepancies Found:", margin + 5, yPos);
        doc.setFont(undefined, 'normal');
        yPos += lineHeight;

        room.discrepancies.forEach(d => {
          const discrepancyText = `- ${d.name}: Expected ${d.expectedCount}, Found ${d.actualCount}. Note: ${d.note}`;
          const discrepancyLines = doc.splitTextToSize(discrepancyText, maxLineWidth - 10);
          checkAndAddPage(discrepancyLines.length * (lineHeight*0.8));
          doc.setTextColor(255, 0, 0); // Red color for discrepancies
          doc.text(discrepancyLines, margin + 10, yPos);
          doc.setTextColor(0, 0, 0); // Reset color to black
          yPos += discrepancyLines.length * (lineHeight*0.8) + (lineHeight * 0.3);
        });
      } else if (!room.missingItemSuggestionForRoom) {
        checkAndAddPage(lineHeight);
        doc.setFontSize(10);
        doc.text("No discrepancies noted by AI for this room.", margin + 5, yPos);
        yPos += lineHeight;
      }
      yPos += lineHeight * 0.5;
    });

    return doc;
  };

  const handleDownload = async (report: InspectionReport) => {
    setDownloadingReportId(report.id);
    try {
        const doc = await generatePdfDocument(report);
        const date = report.inspectionDate.toDate();
        const formattedDate = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
        doc.save(`Inspection_Report_${homeName.replace(/\s/g, '_')}_${formattedDate}.pdf`);
    } catch (e) {
        console.error("PDF generation failed", e);
    } finally {
        setDownloadingReportId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-6 w-6" /> Inspection History for {homeName}
          </DialogTitle>
          <DialogDescription>
            Review past inspections and download reports.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : reports.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inspection Date</TableHead>
                  <TableHead>Inspected By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      {report.inspectionDate.toDate().toLocaleDateString()}
                    </TableCell>
                    <TableCell>{report.inspectedBy}</TableCell>
                    <TableCell>{report.overallStatus}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(report)}
                        disabled={downloadingReportId === report.id}
                      >
                        {downloadingReportId === report.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileDown className="mr-2 h-4 w-4" />
                        )}
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No History Found</AlertTitle>
              <AlertDescription>
                There are no completed inspection reports for this home yet.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

    