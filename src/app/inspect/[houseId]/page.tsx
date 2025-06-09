
"use client";

import type { NextPage } from 'next';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { getHome, getRooms, saveInspectionReport, getUserEmail } from '@/lib/firestore';
import type { Home, Room, InspectionReport, RoomInspectionReportData } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertTriangle, Home as HomeIcon, ArrowRight, ArrowLeft, Info, Download, Send, XCircle } from 'lucide-react';
import { RoomInspectionStep } from '@/components/inspection/RoomInspectionStep';
import { useToast } from '@/hooks/use-toast';
import { identifyDiscrepancies } from '@/ai/flows/identify-discrepancies-flow';
import Image from "next/image";
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { useAiAnalysisLoader } from '@/contexts/AiAnalysisLoaderContext';

const PublicInspectionPage: NextPage = () => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { showAiLoader, hideAiLoader } = useAiAnalysisLoader();
  const houseId = params.houseId as string;

  const [home, setHome] = React.useState<Home | null>(null);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [currentRoomIndex, setCurrentRoomIndex] = React.useState(0);
  const [inspectorName, setInspectorName] = React.useState('');
  const [roomReports, setRoomReports] = React.useState<RoomInspectionReportData[]>([]);
  
  const [pageLoading, setPageLoading] = React.useState(true);
  const [isSubmittingReport, setIsSubmittingReport] = React.useState(false);
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  const [inspectionComplete, setInspectionComplete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = React.useState<InspectionReport | null>(null);
  const [generatedPdfForEmail, setGeneratedPdfForEmail] = React.useState<jsPDF | null>(null);

  React.useEffect(() => {
    if (houseId) {
      const fetchHouseData = async () => {
        setPageLoading(true);
        setError(null);
        try {
          const fetchedHome = await getHome(houseId);
          if (!fetchedHome) {
            setError("Inspection details not found. This link may be invalid or expired.");
            setPageLoading(false);
            return;
          }
          setHome(fetchedHome);
          const fetchedRooms = await getRooms(houseId);
          if (fetchedRooms.length === 0) {
            setError("This home has no rooms configured for inspection.");
          }
          setRooms(fetchedRooms);
          // Reset state for a new inspection session if houseId changes or on initial load
          setCurrentRoomIndex(0);
          setRoomReports([]);
          setInspectorName('');
          setInspectionComplete(false);
          setGeneratedReport(null);
          setGeneratedPdfForEmail(null);


        } catch (err) {
          console.error("Error fetching inspection data:", err);
          setError("Could not load inspection details. Please try again later.");
        } finally {
          setPageLoading(false);
        }
      };
      fetchHouseData();
    }
  }, [houseId]);

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
      setCurrentRoomIndex(prev => prev - 1); 
    }
  };

  const generatePdfDocument = (reportDetails: InspectionReport): jsPDF => {
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
    doc.text(`Date: ${format(reportDetails.inspectionDate instanceof Date ? reportDetails.inspectionDate : reportDetails.inspectionDate.toDate(), 'PPP p')}`, margin, yPos);
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

      // Display "Message from Owner" for the room (AI's specific suggestion)
      if (room.missingItemSuggestionForRoom) {
        checkAndAddPage(lineHeight * 2); 
        doc.setFontSize(10);
        doc.setFont(undefined, 'italic');
        const ownerMessagePrefix = "Note for Room:"; // Changed label for PDF
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
          doc.text(discrepancyLines, margin + 10, yPos);
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

  const triggerPdfDownload = (pdfDoc: jsPDF | null, reportDetails: InspectionReport | null) => {
    if (!pdfDoc || !reportDetails) {
        toast({ title: "Error", description: "Report data not available for download.", variant: "destructive"});
        return;
    }
    const pdfFileName = `Inspection_Report_${reportDetails.homeName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    pdfDoc.save(pdfFileName);
    toast({ title: "Report Downloaded", description: `PDF report ${pdfFileName} generated.` });
  };


  const handleSubmitInspection = async () => {
    if (!home || !inspectorName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your name before submitting the inspection.",
        variant: "destructive",
      });
      return;
    }
    if (roomReports.length !== rooms.length) {
        toast({
            title: "Incomplete Inspection",
            description: `Please complete the inspection for all ${rooms.length} rooms. Only ${roomReports.length} completed.`,
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
        inspectedBy: inspectorName,
        rooms: roomReports,
        overallStatus: roomReports.some(r => r.discrepancies.length > 0) ? "Completed with discrepancies" : "Completed - All Clear",
      };
      
      const newReportId = await saveInspectionReport(reportToSave);
      const fullReportForPdf: InspectionReport = {
        ...reportToSave,
        id: newReportId,
        inspectionDate: new Date() as any, 
      };
      setGeneratedReport(fullReportForPdf); 
      
      const pdfDoc = generatePdfDocument(fullReportForPdf);
      setGeneratedPdfForEmail(pdfDoc); 
      // Do NOT automatically download:
      // triggerPdfDownload(pdfDoc, fullReportForPdf); 

      setInspectionComplete(true);
      toast({
        title: "Inspection Completed!",
        description: "Report has been generated. You can now send it to the owner or download it.",
        duration: 7000,
      });

    } catch (err) {
      console.error("Error submitting inspection report:", err);
      toast({
        title: "Submission Failed",
        description: "Could not submit the inspection report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingReport(false);
      hideAiLoader(); 
    }
  };

  const handleSendReportToOwner = async () => {
    if (!generatedReport || !generatedPdfForEmail || !home?.ownerId) {
      toast({ title: "Error", description: "Report data not available or owner not identified.", variant: "destructive" });
      return;
    }
    setIsSendingEmail(true);
    showAiLoader();

    try {
      const pdfBase64 = generatedPdfForEmail.output('datauristring').split(',')[1];
      
      const response = await fetch('/api/send-inspection-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: home.ownerId,
          homeName: generatedReport.homeName,
          inspectedBy: generatedReport.inspectedBy,
          pdfBase64: pdfBase64,
          inspectionDate: generatedReport.inspectionDate.toISOString(), 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to send email (${response.status})`);
      }

      toast({ title: "Report Sent", description: "The inspection report has been emailed to the owner." });
    } catch (err: any) {
      console.error("Error sending report:", err);
      toast({ title: "Email Sending Failed", description: err.message || "Could not send the report.", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
      hideAiLoader();
    }
  };
  
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/arc-stay.firebasestorage.app/o/Homiestan.png?alt=media";

  if (pageLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading inspection details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Inspection Error</h1>
        <p className="text-muted-foreground">{error}</p>
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
            <CardTitle className="text-2xl">Inspection Completed!</CardTitle>
            <CardDescription>
              Thank you, <strong>{inspectorName || "Inspector"}</strong>. The report for <strong>{home?.name}</strong> has been generated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
                onClick={() => triggerPdfDownload(generatedPdfForEmail, generatedReport)} 
                className="w-full"
                disabled={!generatedPdfForEmail || isSendingEmail}
            >
              <Download className="mr-2 h-4 w-4" /> Download Report Again
            </Button>
            <Button 
              variant="default" 
              className="w-full" 
              onClick={handleSendReportToOwner}
              disabled={isSendingEmail || !home?.ownerId || !generatedPdfForEmail}
            >
              {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {isSendingEmail ? "Sending..." : "Send Report to Owner"}
            </Button>
             <Button 
              variant="ghost" 
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={() => {
                setInspectionComplete(false); 
                setGeneratedReport(null);
                setGeneratedPdfForEmail(null);
                setCurrentRoomIndex(0);
                setRoomReports([]);
                setInspectorName(''); 
                router.push('/'); 
              }}
            >
             <XCircle className="mr-2 h-4 w-4" /> Close & Reset
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentRoom = rooms[currentRoomIndex];
  const ownerName = home?.ownerDisplayName || "the Owner";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 p-4 sm:p-8 flex flex-col items-center">
       <Image src={logoUrl} alt="HomieStan Logo" width={180} height={45} className="mb-6" data-ai-hint="logo company" />
      <Card className="w-full max-w-2xl shadow-2xl bg-card text-card-foreground">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-center">
            Property Inspection: {home?.name}
          </CardTitle>
          <CardDescription className="text-center text-base pt-2">
            Hi {inspectorName || "Inspector"}, you are inspecting on behalf of {ownerName}. Please follow the steps below.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          
          <div className="space-y-2">
            <label htmlFor="inspectorName" className="block text-sm font-medium text-muted-foreground">Your Name (Inspector):</label>
            <Input
              id="inspectorName"
              type="text"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              placeholder="Enter your full name"
              className="bg-input text-foreground placeholder:text-muted-foreground/70"
              disabled={inspectionComplete || roomReports.length > 0} 
            />
             {roomReports.length > 0 && <p className="text-xs text-muted-foreground">Inspector name is locked after first room completion.</p>}
          </div>

          {inspectorName.trim() && currentRoom && !inspectionComplete && (
            <>
              <Alert variant="default" className="my-4 bg-primary/10 border-primary/30 text-primary-foreground">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary">Current Room</AlertTitle>
                <AlertDescription className="text-primary/90">
                  You are now inspecting the: <strong>{currentRoom.name}</strong>.
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
          
          {!currentRoom && rooms.length > 0 && !inspectionComplete && !pageLoading && inspectorName.trim() && (
             <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Ready to Start Inspection</AlertTitle>
                <AlertDescription>
                  Press "Next Room" to begin inspecting <strong>{rooms[0]?.name}</strong>, or proceed if you've already started.
                </AlertDescription>
              </Alert>
          )}
           {!currentRoom && rooms.length > 0 && !inspectionComplete && !pageLoading && !inspectorName.trim() && (
             <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Ready to Start?</AlertTitle>
                <AlertDescription>
                  Please enter your name above to begin the inspection for the first room: <strong>{rooms[0]?.name}</strong>.
                </AlertDescription>
              </Alert>
          )}
          
          {rooms.length === 0 && !pageLoading && (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No Rooms Found</AlertTitle>
                <AlertDescription>
                  This property has no rooms configured for inspection. Please contact the owner.
                </AlertDescription>
              </Alert>
          )}

        </CardContent>

        {inspectorName.trim() && rooms.length > 0 && !inspectionComplete && (
          <CardFooter className="border-t border-border pt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Room {currentRoomIndex + 1} of {rooms.length}: {currentRoom?.name}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handlePreviousRoom}
                disabled={currentRoomIndex === 0 || isSubmittingReport}
                variant="outline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
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
                  disabled={isSubmittingReport || !roomReports.find(r => r.roomId === currentRoom?.id) || roomReports.length !== rooms.length}
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

    