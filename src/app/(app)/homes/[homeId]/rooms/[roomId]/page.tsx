
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getHome, getRoom, updateRoomAnalysisData, clearRoomAnalysisData, removeAnalyzedRoomPhoto, setRoomAnalyzingStatus } from "@/lib/firestore";
import type { Home, Room } from "@/types";
import { PhotoUploader } from "@/components/rooms/PhotoUploader";
import { ObjectAnalysisCard } from "@/components/rooms/ObjectAnalysisCard";
import { ImageGallery } from "@/components/rooms/ImageGallery";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, DoorOpen, Home as HomeIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAiAnalysisLoader } from "@/contexts/AiAnalysisLoaderContext";
import { describeRoomObjects } from "@/ai/flows/describe-room-objects";
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

export default function RoomDetailPage() {
  const { user } = useAuthContext();
  const params = useParams();
  const homeId = params.homeId as string;
  const roomId = params.roomId as string;
  const { toast } = useToast();
  const { showAiLoader, hideAiLoader } = useAiAnalysisLoader();

  const [home, setHome] = useState<Home | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [isProcessingFullAnalysis, setIsProcessingFullAnalysis] = useState(false);
  
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]); // For PhotoUploader's pending list
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);


  const fetchRoomDetails = useCallback(async (showLoadingIndicator = true) => {
    if (user && homeId && roomId) {
      if (showLoadingIndicator) setPageLoading(true);
      try {
        const currentHome = await getHome(homeId);
        if (currentHome && currentHome.ownerId === user.uid) {
          setHome(currentHome);
          const currentRoom = await getRoom(homeId, roomId);
          setRoom(currentRoom);
        } else {
          setHome(null);
          setRoom(null);
          toast({ title: "Access Denied", description: "Room not found or you do not have access.", variant: "destructive" });
        }
      } catch (error) {
        console.error("Failed to fetch room details:", error);
        toast({ title: "Error", description: "Failed to fetch room details.", variant: "destructive" });
      } finally {
        if (showLoadingIndicator) setPageLoading(false);
      }
    }
  }, [user, homeId, roomId, toast]);

  useEffect(() => {
    fetchRoomDetails();
  }, [fetchRoomDetails]);

  const handlePhotosChange = (newPhotos: File[]) => {
    setUploadedPhotos(newPhotos);
  };

  const handleRemovePendingPhoto = (indexToRemove: number) => {
    setUploadedPhotos(prevPhotos => prevPhotos.filter((_, index) => index !== indexToRemove));
  };

  const performFullRoomAnalysis = async (photoUrlsToAnalyze: string[]) => {
    if (!homeId || !roomId || !user?.uid) {
      toast({ title: "Error", description: "Cannot perform analysis. Missing required information.", variant: "destructive" });
      return;
    }

    if (photoUrlsToAnalyze.length === 0) {
      // No photos to analyze, so clear existing analysis
      setIsProcessingFullAnalysis(true); // Show some indicator if needed
      showAiLoader(); // Use global AI loader
      try {
        await updateRoomAnalysisData(homeId, roomId, [], [], user.uid);
        toast({ title: "Analysis Cleared", description: "No photos remaining. Object analysis for the room has been cleared." });
        fetchRoomDetails(false); // Refresh room data without full page loader
      } catch (error) {
        console.error("Error clearing room analysis data when no photos left:", error);
        toast({ title: "Update Error", description: "Failed to clear analysis results.", variant: "destructive" });
      } finally {
        setIsProcessingFullAnalysis(false);
        hideAiLoader();
      }
      return;
    }

    setIsProcessingFullAnalysis(true);
    showAiLoader();
    try {
      await setRoomAnalyzingStatus(homeId, roomId, true);
      toast({ title: "Full Room Re-analysis", description: `Analyzing all ${photoUrlsToAnalyze.length} photos... This may take a moment.`, duration: 5000 });

      const result = await describeRoomObjects({ photoDataUris: photoUrlsToAnalyze });
      
      if (result && result.objects) {
        await updateRoomAnalysisData(homeId, roomId, result.objects, photoUrlsToAnalyze, user.uid);
        toast({ title: "Room Re-analysis Complete!", description: "The object list for the room has been updated based on all current photos." });
      } else {
        throw new Error("AI analysis did not return the expected object structure.");
      }
      fetchRoomDetails(false); // Refresh room data
    } catch (error: any) {
      console.error("Error during full room re-analysis:", error);
      toast({ title: "Re-analysis Failed", description: error.message || "Could not re-analyze room objects.", variant: "destructive" });
      await setRoomAnalyzingStatus(homeId, roomId, false); // Reset status on error
    } finally {
      setIsProcessingFullAnalysis(false);
      hideAiLoader();
    }
  };

  const handleAnalysisComplete = async (newlyUploadedPhotoUrls?: string[]) => {
    // This is called by PhotoUploader after it *only* uploads photos.
    // hideAiLoader(); // PhotoUploader's internal loader is hidden by itself or here
    
    setUploadedPhotos([]); // Clear the pending photos from PhotoUploader UI

    if (newlyUploadedPhotoUrls && newlyUploadedPhotoUrls.length > 0) {
      const existingPhotoUrls = room?.analyzedPhotoUrls || [];
      const allCurrentPhotoUrls = Array.from(new Set([...existingPhotoUrls, ...newlyUploadedPhotoUrls]));
      await performFullRoomAnalysis(allCurrentPhotoUrls);
    } else {
      toast({ title: "Upload Issue", description: "No new photos were processed by the uploader. Re-analysis skipped.", variant: "destructive"});
      fetchRoomDetails(false); // Refresh to ensure consistent state
    }
  };

  const handleClearResults = async () => {
    if (!homeId || !roomId || !user?.uid) {
      toast({ title: "Error", description: "Cannot clear results. Missing required information.", variant: "destructive" });
      return;
    }
    setPageLoading(true); 
    try {
      await clearRoomAnalysisData(homeId, roomId, user.uid);
      toast({ title: "Results Cleared", description: "The object analysis results and stored images have been cleared." });
      setUploadedPhotos([]); 
      fetchRoomDetails();
    } catch (error: any) {
      console.error("Failed to clear results:", error);
      toast({ title: "Error", description: "Failed to clear analysis results: " + error.message, variant: "destructive" });
    } finally {
      setPageLoading(false);
    }
  };

  const confirmRemoveAnalyzedPhoto = async () => {
    if (!photoToDelete || !homeId || !roomId || !user?.uid) {
      toast({ title: "Error", description: "Cannot delete photo. Missing required information.", variant: "destructive" });
      setPhotoToDelete(null);
      return;
    }
    
    setPageLoading(true); // Show general page loader for the delete operation
    let photoSuccessfullyRemoved = false;

    try {
      // This Firestore function now only removes the URL and deletes from storage.
      await removeAnalyzedRoomPhoto(homeId, roomId, photoToDelete, user.uid);
      toast({ title: "Photo Removed", description: "Photo deleted. Re-analyzing remaining photos for the room..." });
      photoSuccessfullyRemoved = true;
    } catch (error: any) {
      console.error("Failed to delete photo from Firestore/Storage:", error);
      toast({ title: "Error Deleting Photo", description: error.message, variant: "destructive" });
    } finally {
      setPageLoading(false);
      setPhotoToDelete(null); 
    }

    if (photoSuccessfullyRemoved) {
      // Fetch the updated room details to get the new list of analyzedPhotoUrls
      const updatedRoomData = await getRoom(homeId, roomId); // Explicitly refetch
      setRoom(updatedRoomData); // Update local room state immediately
      
      if (updatedRoomData && updatedRoomData.analyzedPhotoUrls) {
        await performFullRoomAnalysis(updatedRoomData.analyzedPhotoUrls);
      } else {
        // Fallback if room data is somehow null after deletion
        await performFullRoomAnalysis([]);
      }
    }
  };


  if (pageLoading && !room) { 
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40 mb-4" />
        <Skeleton className="h-10 w-72 mb-6" />
        <div className="grid lg:grid-cols-2 gap-8">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
         <Skeleton className="h-60 rounded-lg mt-6" />
      </div>
    );
  }

  if (!home || !room) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-2">Room Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The room you are looking for does not exist or you may not have access.
        </p>
        <Button asChild variant="outline">
          <Link href={homeId ? `/homes/${homeId}` : "/dashboard"}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Link>
        </Button>
      </div>
    );
  }

  const displayAnalyzing = room.isAnalyzing || isProcessingFullAnalysis;

  return (
    <>
    <div className="space-y-8">
      <Button variant="ghost" size="sm" asChild className="mb-2 hover:bg-accent">
        <Link href={`/homes/${homeId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to {home?.name || "Home"}
        </Link>
      </Button>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-card/70 rounded-lg shadow">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <DoorOpen className="h-8 w-8 text-primary" />
          {room.name}
          {displayAnalyzing && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
        </h1>
        <p className="text-sm text-muted-foreground">
          Part of <HomeIcon className="inline h-4 w-4 mr-1" /> {home.name}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <PhotoUploader
          homeId={homeId}
          roomId={roomId}
          userId={user?.uid || ""}
          onAnalysisComplete={handleAnalysisComplete}
          currentPhotos={uploadedPhotos}
          onPhotosChange={handlePhotosChange}
        />
        <ImageGallery 
          pendingPhotos={uploadedPhotos} 
          analyzedPhotoUrls={room.analyzedPhotoUrls || []}
          onRemovePendingPhoto={handleRemovePendingPhoto}
          onRemoveAnalyzedPhoto={(url) => setPhotoToDelete(url)} 
        />
      </div>
       <ObjectAnalysisCard
         room={{...room, isAnalyzing: displayAnalyzing }} // Pass the combined analyzing state
         onClearResults={handleClearResults}
         homeName={home.name}
        />
    </div>
    <AlertDialog open={!!photoToDelete} onOpenChange={(open) => !open && setPhotoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this photo? 
              This will remove the photo and trigger a re-analysis of the remaining photos for this room. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPhotoToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveAnalyzedPhoto} className="bg-destructive hover:bg-destructive/90">
              Delete Photo & Re-analyze Room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
