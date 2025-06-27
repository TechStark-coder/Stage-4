
"use client";

import type { NextPage } from 'next';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { getHome, getRooms, saveInspectionReport, recordTenantInspectionLinkAccess, deactivateTenantInspectionLink, getTenantInspectionLink } from '@/lib/firestore';
import type { Home, Room, InspectionReport, RoomInspectionReportData, TenantInspectionLink } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertTriangle, Home as HomeIcon, ArrowRight, Info, Download, Send, XCircle, LinkIcon, MonitorOff, ArrowLeft } from 'lucide-react';
import { RoomInspectionStep } from '@/components/inspection/RoomInspectionStep';
import { useToast } from '@/hooks/use-toast';
import { identifyDiscrepancies } from '@/ai/flows/identify-discrepancies-flow';
import Image from "next/image";
import jsPDF from 'jspdf';
import { useAiAnalysisLoader } from '@/contexts/AiAnalysisLoaderContext';
import { useIsMobile } from '@/hooks/use-mobile';

const PublicInspectionPage: NextPage = () => {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { showAiLoader, hideAiLoader } = useAiAnalysisLoader();
  const houseId = params.houseId as string;
  const isMobile = useIsMobile();

  const [home, setHome] = React.useState<Home | null>(null);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [currentRoomIndex, setCurrentRoomIndex] = React.useState(0);
  const [roomReports, setRoomReports] = React.useState<RoomInspectionReportData[]>([]);
  const [activeLinkId, setActiveLinkId] = React.useState<string | null>(null);

  const [pageLoading, setPageLoading] = React.useState(true);
  const [isSubmittingReport, setIsSubmittingReport] = React.useState(false);
  const [inspectionComplete, setInspectionComplete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = React.useState<InspectionReport | null>(null);
  const [generatedPdfForEmail, setGeneratedPdfForEmail] = React.useState<jsPDF | null>(null);
  const [tenantNameFromLink, setTenantNameFromLink] = React.useState<string | null>(null);


  React.useEffect(() => {
    // Wait until mobile check is complete before fetching data
    if (isMobile === null) {
      return;
    }
    
    // If not mobile, just stop and let the render logic handle the message.
    if (isMobile === false) {
      setPageLoading(false);
      return;
    }

    const linkIdFromQuery = searchParams.get('linkId');
    if (linkIdFromQuery) {
      setActiveLinkId(linkIdFromQuery);
    } else {
      setError("Inspection link ID is missing. Please use the link provided by the home owner.");
      setPageLoading(false);
      return;
    }

    if (houseId && linkIdFromQuery) {
      const fetchHouseDataAndRecordAccess = async () => {
        setPageLoading(true);
        setError(null);
        try {
          await recordTenantInspectionLinkAccess(houseId, linkIdFromQuery);
          
          // If the above call succeeds, the link is active. Load the inspection page normally.
          const fetchedHome = await getHome(houseId);
          if (!fetchedHome) {
            setError(`Home details (ID: ${houseId}) could not be found.`);
            setPageLoading(false);
            return;
          }
          setHome(fetchedHome);

          const fetchedLinkDetails = await getTenantInspectionLink(houseId, linkIdFromQuery);
          if (fetchedLinkDetails && fetchedLinkDetails.tenantName) {
            setTenantNameFromLink(fetchedLinkDetails.tenantName);
          } else if (!fetchedLinkDetails) {
            setError("Could not retrieve details for the inspection link. It might be an invalid ID.");
            setPageLoading(false);
            return;
          }

          const fetchedRooms = await getRooms(houseId);
          if (fetchedRooms.length === 0) {
            setError("This home has no rooms configured for inspection.");
          }
          setRooms(fetchedRooms);
          setRoomReports([]);
          setInspectionComplete(false);
          setGeneratedReport(null);
          setGeneratedPdfForEmail(null);

        } catch (err: any) {
           // Check if the error is because the link is inactive (already used).
           if (err.message && (err.message.includes("is not active") || err.message.includes("has expired"))) {
            console.log("Inactive link accessed, attempting to show completion page.");
            const linkDetails = await getTenantInspectionLink(houseId, linkIdFromQuery);
            const homeDetails = await getHome(houseId);

            // If we have the link, home, and a report ID, show the completion page.
            if (linkDetails && homeDetails && linkDetails.reportId) {
              setHome(homeDetails);
              setTenantNameFromLink(linkDetails.tenantName);
              // Create a report object to render the completion card.
              const dummyReport: InspectionReport = {
                id: linkDetails.reportId,
                houseId: homeDetails.id,
                homeName: homeDetails.name,
                homeOwnerName: homeDetails.ownerDisplayName || 'Home Owner',
                inspectedBy: linkDetails.tenantName,
                inspectionDate: linkDetails.lastAccessedAt || linkDetails.createdAt, // Best guess
                rooms: [], // Not needed for this card
                overallStatus: 'Completed',
                tenantLinkId: linkIdFromQuery,
              };
              const pdfDoc = await generatePdfDocument(dummyReport);
              setGeneratedPdfForEmail(pdfDoc);
              setGeneratedReport(dummyReport);
              setInspectionComplete(true);
            } else {
              setError(`The inspection link is no longer valid and the original report could not be found.`);
            }
          } else {
            // It's a different error (e.g., link not found).
            console.error("Error during inspection setup:", err);
            setError(`Could not load inspection details. Problem: ${err.message}. Please check the link or contact the home owner.`);
          }
        } finally {
          setPageLoading(false);
        }
      };
      fetchHouseDataAndRecordAccess();
    } else if (!houseId) {
        setError("Home ID is missing from the link. Please use a valid inspection link.");
        setPageLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId, searchParams, isMobile]);

  const handleRoomInspectionComplete = (reportData: RoomInspectionReportData) => {
    setRoomReports(prev => {
      const existingReportIndex = prev.findIndex(r => r.roomId === reportData.roomId);
      if (existingReportIndex > -1) {
        const updatedReports = [...prev];
        updatedReports[existingReportIndex] = reportData;
        return updatedReports;
      }
      return [...prev, reportData];
    });
  };

  const handleNextRoom = () => {
    if (currentRoomIndex < rooms.length - 1) {
      setCurrentRoomIndex(prev => prev + 1);
    }
  };

  const handlePreviousRoom = () => {
    if (currentRoomIndex > 0) {
      setCurrentRoomIndex(prev => prev + 1);
    }
  };

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
    
    const inspectionDate = reportDetails.inspectionDate instanceof Date ? reportDetails.inspectionDate : reportDetails.inspectionDate.toDate();
    const formattedDate = inspectionDate.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    doc.text(`Date: ${formattedDate}`, margin, yPos);
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

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
            "HomieStan 2025 by ARC Stay",
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: "center" }
        );
    }
    
    return doc;
  };

  const triggerPdfDownload = async (reportDetails: InspectionReport | null) => {
    if (!reportDetails) {
        toast({ title: "Error", description: "Report data not available for download.", variant: "destructive"});
        return;
    }
    const pdfDoc = await generatePdfDocument(reportDetails);
    const pdfFileName = `Inspection_Report_${reportDetails.homeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdfDoc.save(pdfFileName);
    toast({ title: "Report Downloaded", description: `PDF report ${pdfFileName} generated.` });
  };


  const handleSubmitInspection = async () => {
    if (!home || !tenantNameFromLink) {
      toast({
        title: "Missing Information",
        description: "Inspector name could not be found from the link.",
        variant: "destructive",
      });
      return;
    }
    if (roomReports.length !== rooms.length && rooms.length > 0) { // Check if rooms > 0 before this validation
        toast({
            title: "Incomplete Inspection",
            description: `Please complete the inspection for all ${rooms.length} rooms. Only ${roomReports.length} completed.`,
            variant: "destructive",
        });
        return;
    }
    if (!activeLinkId) {
        toast({
            title: "Link Error",
            description: "Inspection link ID is missing. Cannot submit report.",
            variant: "destructive",
        });
        return;
    }

    setIsSubmittingReport(true);
    showAiLoader();

    try {
      const reportToSave: Omit<InspectionReport, 'id' | 'inspectionDate'> = {
        houseId: home.id,
        homeOwnerName: home.ownerDisplayName || "Home Owner",
        homeName: home.name,
        inspectedBy: tenantNameFromLink,
        rooms: roomReports,
        overallStatus: roomReports.some(r => r.discrepancies.length > 0) ? "Completed with discrepancies" : "Completed - All Clear",
        tenantLinkId: activeLinkId,
      };

      const newReportId = await saveInspectionReport(reportToSave);
      
      const fullReportForEmailAndPdf: InspectionReport = {
        ...reportToSave,
        id: newReportId,
        inspectionDate: new Date() as any, 
      };
      setGeneratedReport(fullReportForEmailAndPdf);

      const pdfDoc = await generatePdfDocument(fullReportForEmailAndPdf);
      setGeneratedPdfForEmail(pdfDoc);

      await deactivateTenantInspectionLink(home.id, activeLinkId, newReportId);

      // Automatically send the report email
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];
      const emailResponse = await fetch('/api/send-inspection-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeId: home.id, 
          homeName: fullReportForEmailAndPdf.homeName,
          inspectedBy: fullReportForEmailAndPdf.inspectedBy,
          pdfBase64: pdfBase64,
          inspectionDate: fullReportForEmailAndPdf.inspectionDate instanceof Date ? fullReportForEmailAndPdf.inspectionDate.toISOString() : fullReportForEmailAndPdf.inspectionDate.toDate().toISOString(),
          overallStatus: fullReportForEmailAndPdf.overallStatus,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        console.error("Failed to auto-send email:", errorData.message);
        toast({
          title: "Inspection Completed, Email Failed",
          description: "Report saved, but we couldn't email the owner. You can still download it.",
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({
          title: "Report Sent!",
          description: "Thank you for the inspection. The report has been sent to the owner.",
          duration: 7000,
        });
      }

      setInspectionComplete(true);

    } catch (err: any) {
      console.error("Error submitting inspection report:", err);
      toast({
        title: "Submission Failed",
        description: err.message || "Could not submit the inspection report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingReport(false);
      hideAiLoader();
    }
  };

  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/arc-stay.firebasestorage.app/o/Homiestan.png?alt=media";

  if (pageLoading || isMobile === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Verifying device and loading details...</p>
      </div>
    );
  }
  
  if (isMobile === false) {
    return (
       <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 p-6 text-center">
        <Image src={logoUrl} alt="HomieStan Logo" width={200} height={50} className="mb-8" data-ai-hint="logo company" />
        <Card className="w-full max-w-md shadow-xl bg-card text-card-foreground p-8">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10 mb-4">
            <MonitorOff className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Mobile Device Required</h1>
          <p className="text-muted-foreground">
            This inspection link is designed for mobile use to allow for photo uploads from your camera.
          </p>
          <p className="text-muted-foreground mt-2">
            Please open this link on your smartphone to proceed.
          </p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Inspection Access Error</h1>
        <p className="text-muted-foreground mb-1">{error}</p>
        <p className="text-sm text-muted-foreground">If the issue persists, please contact the home owner or try refreshing.</p>
        <Button onClick={() => router.push('/')} className="mt-6">Go to Homepage</Button>
      </div>
    );
  }

  if (inspectionComplete && generatedReport) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 p-6">
         <Image src={logoUrl} alt="HomieStan Logo" width={200} height={50} className="mb-8" data-ai-hint="logo company" />
        <Card className="w-full max-w-lg shadow-xl bg-card text-card-foreground">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Inspection Submitted!</CardTitle>
            <CardDescription>
              Thank you, <strong>{tenantNameFromLink || "Inspector"}</strong>. The report for <strong>{home?.name}</strong> has been sent to the owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
                onClick={() => triggerPdfDownload(generatedReport)}
                className="w-full"
                disabled={!generatedReport}
            >
              <Download className="mr-2 h-4 w-4" /> Download My Copy
            </Button>
             <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={() => {
                window.location.href = 'https://www.google.com';
              }}
            >
             <XCircle className="mr-2 h-4 w-4" /> Close & Exit
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentRoom = rooms[currentRoomIndex];
  const currentInspectorName = tenantNameFromLink || "Inspector";


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 p-4 sm:p-8 flex flex-col items-center">
       <Image src={logoUrl} alt="HomieStan Logo" width={180} height={45} className="mb-6" data-ai-hint="logo company"/>
      <Card className="w-full max-w-2xl shadow-2xl bg-card text-card-foreground">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-center">
            Property Inspection: {home?.name}
          </CardTitle>
          <CardDescription className="text-center text-base pt-2">
             Hi {currentInspectorName}, Welcome, Please follow the steps below to complete the inspection.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {currentRoom && !inspectionComplete && (
            <>
              <Alert variant="default" className="my-4 bg-primary/10 border-primary/30 text-primary-foreground">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary">Current Room</AlertTitle>
                <AlertDescription className="text-primary/90">
                  You are now inspecting the: <strong>{currentRoom.name}</strong>. ({currentRoomIndex + 1} of {rooms.length})
                  Ensure all photos are for this room.
                </AlertDescription>
              </Alert>
              <RoomInspectionStep
                key={currentRoom.id}
                homeId={houseId}
                room={currentRoom}
                onInspectionStepComplete={handleRoomInspectionComplete}
                aiIdentifyDiscrepancies={identifyDiscrepancies}
                toast={toast}
              />
            </>
          )}

          {!currentRoom && rooms.length > 0 && !inspectionComplete && !pageLoading && (
             <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Ready to Start Inspection</AlertTitle>
                <AlertDescription>
                  Press "Next Room" to begin inspecting <strong>{rooms[0]?.name}</strong>.
                </AlertDescription>
              </Alert>
          )}

          {rooms.length === 0 && !pageLoading && !error && ( 
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No Rooms Found</AlertTitle>
                <AlertDescription>
                  This property has no rooms configured for inspection. Please contact the owner.
                </AlertDescription>
              </Alert>
          )}

        </CardContent>

        {tenantNameFromLink && rooms.length > 0 && !inspectionComplete && (
          <CardFooter className="border-t border-border pt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Room {Math.min(currentRoomIndex + 1, rooms.length)} of {rooms.length}{currentRoom ? `: ${currentRoom.name}` : ''}
            </div>
            <div className="flex gap-3 flex-wrap items-center justify-center sm:justify-end w-full sm:w-auto">
              {currentRoomIndex > 0 && (
                <Button
                  onClick={handlePreviousRoom}
                  disabled={isSubmittingReport}
                  variant="outline"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Previous Room
                </Button>
              )}

              {currentRoomIndex < rooms.length - 1 ? (
                <Button
                  onClick={handleNextRoom}
                  disabled={isSubmittingReport || !roomReports.find(r => r.roomId === currentRoom?.id)}
                >
                  Next Room <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmitInspection}
                  disabled={
                    isSubmittingReport ||
                    !roomReports.find(r => r.roomId === currentRoom?.id) ||
                    (rooms.length > 0 && roomReports.length !== rooms.length)
                  }
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSubmittingReport ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  {isSubmittingReport ? "Completing..." : "Complete inspection"}
                </Button>
              )}
            </div>

          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default PublicInspectionPage;

    
