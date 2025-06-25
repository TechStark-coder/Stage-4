
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
import { getInspectionReportsForHome, deleteInspectionReport, getTenantInspectionLinks, deleteTenantInspectionLink, reactivateTenantInspectionLink } from "@/lib/firestore";
import type { InspectionReport, TenantInspectionLink } from "@/types";
import { History, FileDown, Loader2, Info, Trash2, Eye, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ReportViewerDialog } from "./ReportViewerDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";


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
  const [links, setLinks] = React.useState<TenantInspectionLink[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [downloadingReportId, setDownloadingReportId] = React.useState<string | null>(null);
  const [reportToDelete, setReportToDelete] = React.useState<InspectionReport | null>(null);
  const [linkToDelete, setLinkToDelete] = React.useState<TenantInspectionLink | null>(null);
  const { toast } = useToast();

  const [reportToView, setReportToView] = React.useState<InspectionReport | null>(null);
  const [isViewerOpen, setIsViewerOpen] = React.useState(false);


  React.useEffect(() => {
    if (isOpen && homeId && currentUserId) {
      setLoading(true);
      Promise.all([
        getInspectionReportsForHome(homeId, currentUserId),
        getTenantInspectionLinks(homeId, currentUserId)
      ]).then(([fetchedReports, fetchedLinks]) => {
          setReports(fetchedReports);
          setLinks(fetchedLinks);
      }).catch(err => {
          console.error("Failed to fetch inspection history:", err);
          toast({ title: "Error", description: "Failed to fetch inspection history.", variant: "destructive" });
          setReports([]);
          setLinks([]);
      }).finally(() => setLoading(false));
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

      if (room.tenantNotes) {
        checkAndAddPage(lineHeight * 2);
        doc.setFontSize(10);
        doc.setFont(undefined, 'italic');
        doc.text("Tenant's Note:", margin + 5, yPos);
        yPos += lineHeight * 0.8;

        doc.setFont(undefined, 'normal');
        const noteLines = doc.splitTextToSize(`  "${room.tenantNotes}"`, maxLineWidth - 10);
        checkAndAddPage(noteLines.length * (lineHeight * 0.8));
        doc.text(noteLines, margin + 5, yPos);
        yPos += noteLines.length * (lineHeight * 0.8) + (lineHeight * 0.5);
      }

      // Create a map of the AI's findings for easy lookup.
      const findingsMap = new Map(room.discrepancies.map(d => [d.name.toLowerCase(), d]));
      const allExpectedItems = room.expectedItems || [];
      
      const foundItems = allExpectedItems.filter(item => !findingsMap.has(item.name.toLowerCase()));
      const missingItems = room.discrepancies;

      // --- Section for Found Items ---
      if (foundItems.length > 0) {
        checkAndAddPage(lineHeight * 2);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text("Room Findings:", margin + 5, yPos);
        yPos += lineHeight;
        
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0); // Black
        foundItems.forEach(item => {
            const itemText = `- ${item.name}`;
            const itemLines = doc.splitTextToSize(itemText, maxLineWidth - 15);
            checkAndAddPage(itemLines.length * (lineHeight * 0.8));
            doc.text(itemLines, margin + 10, yPos);
            yPos += itemLines.length * (lineHeight * 0.8) + (lineHeight * 0.3);
        });
        yPos += lineHeight * 0.5;
      }
      
      // --- Section for Missing Items ---
      if (missingItems.length > 0) {
        checkAndAddPage(lineHeight * 2);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text("Missing Items:", margin + 5, yPos);
        yPos += lineHeight;

        doc.setFont(undefined, 'normal');
        doc.setTextColor(255, 0, 0); // Red
        missingItems.forEach(item => {
            const itemText = `- ${item.name}`;
            const itemLines = doc.splitTextToSize(itemText, maxLineWidth - 15);
            checkAndAddPage(itemLines.length * (lineHeight * 0.8));
            doc.text(itemLines, margin + 10, yPos);
            yPos += itemLines.length * (lineHeight * 0.8) + (lineHeight * 0.3);
        });
        
        doc.setTextColor(0, 0, 0); // Reset color
        yPos += lineHeight * 0.5;
      }

      // If no items at all, and no notes, show a message
      if (foundItems.length === 0 && missingItems.length === 0 && !room.tenantNotes) {
        checkAndAddPage(lineHeight);
        doc.setFontSize(10);
        doc.text("No items or notes were recorded for this room.", margin + 5, yPos);
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
      const linkIdToReactivate = reportToDelete.tenantLinkId;

      // First, delete the report itself
      await deleteInspectionReport(reportToDelete.id, currentUserId);

      // Then, if it has an associated link ID, reactivate it
      if (linkIdToReactivate) {
        await reactivateTenantInspectionLink(homeId, linkIdToReactivate, currentUserId);
        
        // Refresh the links list in the UI to show its new "Active" state
        setLinks((prevLinks) => 
          prevLinks.map(link => 
            link.id === linkIdToReactivate 
              ? { ...link, isActive: true, reportId: null } 
              : link
          )
        );
      }

      // Refresh reports list by removing the deleted one
      setReports((prev) => prev.filter((r) => r.id !== reportToDelete.id));

      toast({ title: "Report Deleted", description: "The inspection report has been deleted and the original link has been reactivated." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setReportToDelete(null);
    }
  };

  const handleDeleteLink = async () => {
    if (!linkToDelete) return;
    try {
      // First, delete the link itself
      await deleteTenantInspectionLink(homeId, linkToDelete.id, currentUserId);

      // Then, if it has an associated report ID, delete the report too
      if (linkToDelete.reportId) {
        await deleteInspectionReport(linkToDelete.reportId, currentUserId);
        // Refresh reports list as well
        setReports((prev) => prev.filter((r) => r.id !== linkToDelete.reportId));
      }
      
      // Refresh links list
      setLinks((prev) => prev.filter((l) => l.id !== linkToDelete.id));

      toast({ title: "Link Deleted", description: "The inspection link and any associated report have been deleted." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLinkToDelete(null);
    }
  };
  
  const handleCopyLink = (linkId: string) => {
    const fullLink = `${window.location.origin}/inspect/${homeId}?linkId=${linkId}`;
    navigator.clipboard.writeText(fullLink).then(() => {
      toast({ title: "Link Copied!", description: "Inspection link copied to clipboard." });
    }).catch(err => {
      console.error("Failed to copy link:", err);
      toast({ title: "Copy Failed", description: "Could not copy link.", variant: "destructive" });
    });
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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="space-y-1.5">
                <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                  <History className="h-6 w-6" /> Inspection History
                </DialogTitle>
                <DialogDescription>
                  Review past inspections and manage generated links for {homeName}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="reports" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="reports">Completed Reports ({reports.length})</TabsTrigger>
                <TabsTrigger value="links">Generated Links ({links.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="reports" className="mt-4 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="space-y-4 p-4">
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
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertTitle>No Reports Found</AlertTitle>
                  <AlertDescription>
                    There are no completed inspection reports for this home yet.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
            <TabsContent value="links" className="mt-4 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="space-y-4 p-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : links.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Created On</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell>{link.tenantName}</TableCell>
                        <TableCell>{format(link.createdAt.toDate(), "PPP")}</TableCell>
                        <TableCell>
                          <Badge variant={link.isActive ? "default" : "secondary"} className={link.isActive ? "bg-green-600/80 hover:bg-green-600" : ""}>
                            {link.isActive ? "Active" : "Used"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {link.isActive && (
                            <Button variant="ghost" size="sm" onClick={() => handleCopyLink(link.id)}>
                               <Copy className="mr-2 h-4 w-4" /> Copy
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLinkToDelete(link)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertTitle>No Links Found</AlertTitle>
                  <AlertDescription>
                    You have not generated any inspection links for this home yet.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>

        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!reportToDelete} onOpenChange={(open) => !open && setReportToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the report from {reportToDelete?.inspectionDate.toDate().toLocaleDateString()} inspected by {reportToDelete?.inspectedBy}? This action cannot be undone. The original inspection link will be reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReport} className="bg-destructive hover:bg-destructive/90">
              Delete Report & Reactivate Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!linkToDelete} onOpenChange={(open) => !open && setLinkToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this link?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the inspection link for {linkToDelete?.tenantName}? This action cannot be undone. If a report was submitted using this link, it will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLink} className="bg-destructive hover:bg-destructive/90">
              Delete Link & Report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <ReportViewerDialog
          report={reportToView}
          isOpen={isViewerOpen}
          onOpenChange={setIsViewerOpen}
      />
    </>
  );
}
