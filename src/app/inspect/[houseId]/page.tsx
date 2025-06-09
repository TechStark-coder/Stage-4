
"use client";

import type { NextPage } from 'next';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { getHome, getRooms, saveInspectionReport } from '@/lib/firestore';
import type { Home, Room, InspectionReport, RoomInspectionReportData } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Textarea removed as "additional notes" was removed
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertTriangle, Home as HomeIcon, ArrowRight, ArrowLeft, Info, Download, Send, XCircle } from 'lucide-react';
import { RoomInspectionStep } from '@/components/inspection/RoomInspectionStep';
import { useToast } from '@/hooks/use-toast';
import { storage } from "@/config/firebase";
// Removed unused storage imports: ref, uploadBytes, getDownloadURL
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
  const [isSubmittingReport, setIsSubmittingReport] = React.useState(false); // Kept for button state, AI loader handles visual
  const [inspectionComplete, setInspectionComplete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = React.useState<InspectionReport | null>(null);

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

  const generatePdfReport = (reportDetails: InspectionReport) => {
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
    doc.text(`Owner: ${reportDetails.homeOwnerName}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Inspected By: ${reportDetails.inspectedBy}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Date: ${format(reportDetails.inspectionDate.toDate(), 'PPP p')}`, margin, yPos);
    yPos += lineHeight * 1.5;

    doc.setFontSize(14);
    doc.text("Room Details & Discrepancies:", margin, yPos);
    yPos += lineHeight * 1.5;

    reportDetails.rooms.forEach(room => {
      checkAndAddPage(lineHeight * 3); // Room title + suggestion
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Room: ${room.roomName}`, margin, yPos);
      doc.setFont(undefined, 'normal');
      yPos += lineHeight;

      if (room.missingItemSuggestionForRoom) {
        checkAndAddPage(lineHeight);
        doc.setFontSize(10);
        doc.text(`Owner's Note: ${room.missingItemSuggestionForRoom}`, margin + 5, yPos, { maxWidth: maxLineWidth -5 });
        yPos += Math.ceil(doc.getTextDimensions(`Owner's Note: ${room.missingItemSuggestionForRoom}`, { maxWidth: maxLineWidth -5 }).h) + lineHeight * 0.5;
      }

      if (room.discrepancies.length > 0) {
        checkAndAddPage(lineHeight);
        doc.setFontSize(10);
        doc.setFont(undefined, 'italic');
        doc.text("Discrepancies:", margin + 5, yPos);
        doc.setFont(undefined, 'normal');
        yPos += lineHeight;

        room.discrepancies.forEach(d => {
          checkAndAddPage(lineHeight);
          const discrepancyText = `- ${d.name}: Expected ${d.expectedCount}, Found ${d.actualCount}. Note: ${d.note}`;
          doc.text(discrepancyText, margin + 10, yPos, { maxWidth: maxLineWidth -10 });
           yPos += Math.ceil(doc.getTextDimensions(discrepancyText, { maxWidth: maxLineWidth -10 }).h) + lineHeight * 0.5;
        });
      } else {
        checkAndAddPage(lineHeight);
        doc.setFontSize(10);
        doc.text("No discrepancies found for this room.", margin + 5, yPos);
        yPos += lineHeight;
      }
      yPos += lineHeight * 0.5; // Extra space between rooms
    });
    
    const pdfFileName = `Inspection_Report_${reportDetails.homeName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(pdfFileName);
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
    showAiLoader(); // Show full-screen loader

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
        inspectionDate: new Date() as any, // Firestore will convert serverTimestamp, for PDF use current client time
      };
      setGeneratedReport(fullReportForPdf); // Save for potential re-download
      
      generatePdfReport(fullReportForPdf); // Generate and download PDF

      setInspectionComplete(true);
      toast({
        title: "Inspection Submitted!",
        description: "Thank you! The report has been saved and downloaded.",
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
      hideAiLoader(); // Hide full-screen loader
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
         <Image src={logoUrl} alt="HomieStan Logo" width={200} height={50} className="mb-8" />
        <Card className="w-full max-w-lg shadow-xl bg-card text-card-foreground">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Inspection Complete!</CardTitle>
            <CardDescription>
              Thank you, <strong>{inspectorName || "Inspector"}</strong>, for completing the inspection for <strong>{home?.name}</strong>.
              The report has been saved and downloaded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => generatePdfReport(generatedReport)} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Download Report Again
            </Button>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => toast({title: "Coming Soon!", description: "This feature will be available in a future update."})}
            >
              <Send className="mr-2 h-4 w-4" /> Send Report to Owner
            </Button>
             <Button 
              variant="ghost" 
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={() => router.push('/')} 
            >
             <XCircle className="mr-2 h-4 w-4" /> Close
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
       <Image src={logoUrl} alt="HomieStan Logo" width={180} height={45} className="mb-6" />
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
          {!currentRoom && rooms.length > 0 && !inspectionComplete && (
             <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Ready to Start?</AlertTitle>
                <AlertDescription>
                  Please enter your name below to begin the inspection.
                </AlertDescription>
              </Alert>
          )}
          
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
             {roomReports.length > 0 && <p className="text-xs text-muted-foreground">Name locked after first room completion.</p>}
          </div>

          {inspectorName.trim() && currentRoom && !inspectionComplete && (
            <RoomInspectionStep
              key={currentRoom.id} 
              homeId={houseId}
              room={currentRoom}
              onInspectionStepComplete={handleRoomInspectionComplete}
              // storage prop removed as direct upload is removed
              aiIdentifyDiscrepancies={identifyDiscrepancies}
              toast={toast}
            />
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
                  disabled={isSubmittingReport || !roomReports.find(r => r.roomId === currentRoom?.id)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSubmittingReport ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  {isSubmittingReport ? "Submitting..." : "Complete & Submit Inspection"}
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

    