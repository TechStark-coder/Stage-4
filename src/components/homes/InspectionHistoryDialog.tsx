
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
import { getInspectionReportsForHome, deleteInspectionReport, deleteAllInspectionReportsForHome } from "@/lib/firestore";
import type { InspectionReport } from "@/types";
import { History, FileDown, Loader2, Info, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ReportViewerDialog } from "./ReportViewerDialog";


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
  const [reportToDelete, setReportToDelete] = React.useState<InspectionReport | null>(null);
  const [isClearingAll, setIsClearingAll] = React.useState(false);
  const { toast } = useToast();

  // State for the report viewer
  const [reportToView, setReportToView] = React.useState<InspectionReport | null>(null);
  const [isViewerOpen, setIsViewerOpen] = React.useState(false);


  React.useEffect(() => {
    if (isOpen && homeId && currentUserId) {
      setLoading(true);
      getInspectionReportsForHome(homeId, currentUserId)
        .then(setReports)
        .catch(err => {
          console.error("Failed to fetch inspection history:", err);
          toast({ title: "Error", description: "Failed to fetch inspection history.", variant: "destructive" });
          setReports([]);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, homeId, currentUserId, toast]);

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
        checkAndAddPage(lineHeight * 2);
        doc.setFontSize(10);
        doc.setFont(undefined, 'italic');
        const ownerMessagePrefix = "Note for Room:";
        doc.text(ownerMessagePrefix, margin + 5, yPos);
        yPos += lineHeight * 0.8;

        doc.setFont(undefined, 'normal');
        const suggestionLines = doc.splitTextToSize(`  ${room.missingItemSuggestionForRoom}`, maxLineWidth - 10);
        checkAndAddPage(suggestionLines.length * (lineHeight * 0.8));
        doc.text(suggestionLines, margin + 5, yPos);
        yPos += suggestionLines.length * (lineHeight * 0.8) + (lineHeight * 0.5);
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
        toast({ title: "PDF Error", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
        setDownloadingReportId(null);
    }
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    try {
      await deleteInspectionReport(reportToDelete.id, currentUserId);
      setReports((prev) => prev.filter((r) => r.id !== reportToDelete.id));
      toast({ title: "Report Deleted", description: "The selected inspection report has been deleted." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setReportToDelete(null);
    }
  };

  const handleClearAllHistory = async () => {
    setIsClearingAll(true);
    try {
      await deleteAllInspectionReportsForHome(homeId, currentUserId);
      setReports([]);
      toast({ title: "History Cleared", description: `All inspection reports for ${homeName} have been deleted.` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsClearingAll(false);
    }
  };
  
  const handleDialogClose = (isOpen: boolean) => {
      onOpenChange(isOpen);
      if (!isOpen) {
          setReportToView(null);
          setIsViewerOpen(false);
      }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="space-y-1.5">
                <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                  <History className="h-6 w-6" /> Inspection History
                </DialogTitle>
                <DialogDescription>
                  Review and manage past inspections for {homeName}.
                </DialogDescription>
              </div>
               {!loading && reports.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isClearingAll} className="shrink-0">
                       {isClearingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                       Clear History
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {reports.length} inspection reports for "{homeName}". This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAllHistory} className="bg-destructive hover:bg-destructive/90">
                        Yes, Clear All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
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
                    <TableHead>Date</TableHead>
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
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                              setReportToView(report);
                              setIsViewerOpen(true);
                          }}
                        >
                            <Eye className="mr-2 h-4 w-4" /> View
                        </Button>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setReportToDelete(report)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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
      
      {/* Confirmation Dialog for single deletion */}
      <AlertDialog open={!!reportToDelete} onOpenChange={(open) => !open && setReportToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the report from {reportToDelete?.inspectionDate.toDate().toLocaleDateString()} inspected by {reportToDelete?.inspectedBy}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReport} className="bg-destructive hover:bg-destructive/90">
              Delete Report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Viewer Dialog */}
      <ReportViewerDialog
          report={reportToView}
          isOpen={isViewerOpen}
          onOpenChange={setIsViewerOpen}
      />
    </>
  );
}
