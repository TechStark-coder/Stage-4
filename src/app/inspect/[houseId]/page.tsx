
"use client";

import type { NextPage } from 'next';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { getHome, getRooms, saveInspectionReport } from '@/lib/firestore';
import type { Home, Room, InspectionDiscrepancy, RoomInspectionReportData, InspectionReport } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertTriangle, Home as HomeIcon, ArrowRight, ArrowLeft, Info } from 'lucide-react';
import { RoomInspectionStep } from '@/components/inspection/RoomInspectionStep'; // New component
import { useToast } from '@/hooks/use-toast';
import { storage } from "@/config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { identifyDiscrepancies, type IdentifyDiscrepanciesInput, type IdentifyDiscrepanciesOutput } from '@/ai/flows/identify-discrepancies-flow';
import Image from "next/image";

const PublicInspectionPage: NextPage = () => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const houseId = params.houseId as string;

  const [home, setHome] = React.useState<Home | null>(null);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [currentRoomIndex, setCurrentRoomIndex] = React.useState(0);
  const [inspectorName, setInspectorName] = React.useState('');
  const [roomReports, setRoomReports] = React.useState<RoomInspectionReportData[]>([]);
  
  const [pageLoading, setPageLoading] = React.useState(true);
  const [isSubmittingReport, setIsSubmittingReport] = React.useState(false);
  const [inspectionComplete, setInspectionComplete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
    } else {
      // Last room completed, move to submission step or summary
      // For now, we'll assume a submit button appears after the last room
    }
  };

  const handlePreviousRoom = () => {
    if (currentRoomIndex > 0) {
      setCurrentRoomIndex(prev => prev - 1);
    }
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
    try {
      const reportToSave: Omit<InspectionReport, 'id' | 'inspectionDate'> = {
        houseId: home.id,
        homeOwnerName: home.ownerDisplayName || "Home Owner",
        homeName: home.name,
        inspectedBy: inspectorName,
        rooms: roomReports,
        overallStatus: roomReports.some(r => r.discrepancies.length > 0) ? "Completed with discrepancies" : "Completed - All Clear",
      };
      await saveInspectionReport(reportToSave);
      setInspectionComplete(true);
      toast({
        title: "Inspection Submitted!",
        description: "Thank you! The inspection report has been sent to the owner.",
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
  
  if (inspectionComplete) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
         <Image src={logoUrl} alt="HomieStan Logo" width={200} height={50} className="mb-8" />
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              <CheckCircle className="h-8 w-8 text-green-500" />
              Inspection Complete!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Thank you, {inspectorName || "Inspector"}, for completing the inspection for <strong>{home?.name}</strong>.
              The report has been successfully submitted to the owner.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">You may now close this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentRoom = rooms[currentRoomIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 p-4 sm:p-8 flex flex-col items-center">
       <Image src={logoUrl} alt="HomieStan Logo" width={180} height={45} className="mb-6" />
      <Card className="w-full max-w-2xl shadow-2xl bg-card text-card-foreground">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-center">
            Property Inspection: {home?.name}
          </CardTitle>
          {home?.ownerDisplayName && (
            <CardDescription className="text-center text-base pt-2">
              Hi {inspectorName || "there"}, you are inspecting on behalf of Mr./Ms. {home.ownerDisplayName}. Please follow the steps.
            </CardDescription>
          )}
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
              disabled={inspectionComplete || roomReports.length > 0} // Disable if inspection started or completed
            />
             {roomReports.length > 0 && <p className="text-xs text-muted-foreground">Name locked after first room completion.</p>}
          </div>

          {inspectorName.trim() && currentRoom && !inspectionComplete && (
            <RoomInspectionStep
              key={currentRoom.id} // Important for re-rendering when room changes
              homeId={houseId}
              room={currentRoom}
              onInspectionStepComplete={handleRoomInspectionComplete}
              storage={storage}
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
