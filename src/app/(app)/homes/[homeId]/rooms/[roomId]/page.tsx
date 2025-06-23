
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
import { ImageLightbox } from "@/components/rooms/ImageLightbox"; // Import the new lightbox component
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
  
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);

  // State for lightbox
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxCurrentIndex, setLightboxCurrentIndex] = useState<number | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [objectUrlsToRevoke, setObjectUrlsToRevoke] = useState<string[]>([]);


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

  // Lightbox handlers
  const openLightbox = (imageUrls: string[], startIndex: number, isPending: boolean = false) => {
    setLightboxImages(imageUrls);
    setLightboxCurrentIndex(startIndex);
    setIsLightboxOpen(true);
    if (isPending) {
      setObjectUrlsToRevoke(imageUrls); 
    }
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    // Revoke object URLs for pending images when lightbox closes
    if (objectUrlsToRevoke.length > 0) {
      objectUrlsToRevoke.forEach(url => URL.revokeObjectURL(url));
      setObjectUrlsToRevoke([]);
    }
    // Reset states after a short delay to allow Dialog's closing animation
    setTimeout(() => {
        setLightboxCurrentIndex(null);
        setLightboxImages([]);
    }, 300); // Adjust delay to match your Dialog's animation duration
  };

  const navigateLightbox = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < lightboxImages.length) {
      setLightboxCurrentIndex(newIndex);
    }
  };


  const handlePhotosChange = (newPhotos: File[]) => {
    setUploadedPhotos(newPhotos);
  };

  const handleRemovePendingPhoto = (indexToRemove: number) => {
    const photoToRemove = uploadedPhotos[indexToRemove];
    if (photoToRemove) {
      // If this photo's URL was used in lightbox, ensure it's handled, though typically lightbox closes before removal
    }
    setUploadedPhotos(prevPhotos => prevPhotos.filter((_, index) => index !== indexToRemove));
  };

  const performFullRoomAnalysis = async (photoUrlsToAnalyze: string[]) => {
    if (!homeId || !roomId || !user?.uid) {
      toast({ title: "Error", description: "Cannot perform analysis. Missing required information.", variant: "destructive" });
      return;
    }

    if (photoUrlsToAnalyze.length === 0) {
      setIsProcessingFullAnalysis(true);
      showAiLoader();
      try {
        await updateRoomAnalysisData(homeId, roomId, [], [], user.uid); 
        toast({ title: "Analysis Cleared", description: "No photos remaining. Object analysis for the room has been cleared." });
        fetchRoomDetails(false);
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
      fetchRoomDetails(false); 
      toast({ title: "Full Room Re-analysis", description: `Analyzing all ${photoUrlsToAnalyze.length} photos... This may take a moment.`, duration: 5000 });

      const result = await describeRoomObjects({ photoDataUris: photoUrlsToAnalyze });
      
      if (result && result.objects) {
        await updateRoomAnalysisData(homeId, roomId, result.objects, photoUrlsToAnalyze, user.uid);
        toast({ title: "Room Re-analysis Complete!", description: "The object list for the room has been updated based on all current photos." });
      } else {
        throw new Error("AI analysis did not return the expected object structure.");
      }
      fetchRoomDetails(false); 
    } catch (error: any) {
      console.error("Error during full room re-analysis:", error);
      toast({ title: "Re-analysis Failed", description: error.message || "Could not re-analyze room objects.", variant: "destructive" });
      await setRoomAnalyzingStatus(homeId, roomId, false); 
      fetchRoomDetails(false);
    } finally {
      setIsProcessingFullAnalysis(false);
      hideAiLoader();
    }
  };

  const handleAnalysisComplete = async (newlyUploadedPhotoUrls?: string[]) => {
    setUploadedPhotos([]);
  
    if (!newlyUploadedPhotoUrls || newlyUploadedPhotoUrls.length === 0) {
      toast({ title: "Upload May Have Issues", description: "No new photos were processed. If you selected photos, please try again.", variant: "destructive" });
      fetchRoomDetails(false);
      return;
    }
  
    if (!homeId || !roomId || !user?.uid) {
      toast({ title: "Error", description: "Cannot perform analysis. Missing required information.", variant: "destructive" });
      return;
    }
  
    setIsProcessingFullAnalysis(true);
    showAiLoader();
    try {
      await setRoomAnalyzingStatus(homeId, roomId, true);
      await fetchRoomDetails(false); // Get latest room data before merge
  
      toast({ title: "Incremental Analysis", description: `Analyzing ${newlyUploadedPhotoUrls.length} new photos... This may take a moment.`, duration: 5000 });
  
      // 1. Analyze only new photos
      const result = await describeRoomObjects({ photoDataUris: newlyUploadedPhotoUrls });
  
      if (result && result.objects) {
        // 2. Merge with existing results
        const existingObjects = room?.analyzedObjects || [];
        const newAnalysisObjects = result.objects;
        
        const mergedObjectsMap = new Map<string, number>();
        const nameMap = new Map<string, string>(); // To preserve original casing
  
        existingObjects.forEach(obj => {
          const key = obj.name.toLowerCase().trim();
          mergedObjectsMap.set(key, obj.count);
          nameMap.set(key, obj.name);
        });
  
        newAnalysisObjects.forEach(newObj => {
          const key = newObj.name.toLowerCase().trim();
          const currentCount = mergedObjectsMap.get(key) || 0;
          mergedObjectsMap.set(key, currentCount + newObj.count);
          if (!nameMap.has(key)) {
            nameMap.set(key, newObj.name); // Store original casing for new items
          }
        });
  
        const finalObjects = Array.from(mergedObjectsMap.entries()).map(([key, count]) => ({
          name: nameMap.get(key)!,
          count: count
        }));
        finalObjects.sort((a, b) => a.name.localeCompare(b.name));
  
        // 3. Combine photo URLs
        const existingPhotoUrls = room?.analyzedPhotoUrls || [];
        const finalPhotoUrls = Array.from(new Set([...existingPhotoUrls, ...newlyUploadedPhotoUrls]));
  
        // 4. Update Firestore with the complete, merged data
        await updateRoomAnalysisData(homeId, roomId, finalObjects, finalPhotoUrls, user.uid);
        toast({ title: "Room Analysis Updated!", description: "The object list has been updated with the new findings." });
      } else {
        throw new Error("AI analysis did not return the expected object structure.");
      }
      
      await fetchRoomDetails(false);
    } catch (error: any) {
      console.error("Error during incremental analysis:", error);
      toast({ title: "Analysis Failed", description: error.message || "Could not analyze new photos.", variant: "destructive" });
      await setRoomAnalyzingStatus(homeId, roomId, false);
      await fetchRoomDetails(false);
    } finally {
      setIsProcessingFullAnalysis(false);
      hideAiLoader();
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
    
    setPageLoading(true);
    let photoSuccessfullyRemoved = false;

    try {
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
      const updatedRoomData = await getRoom(homeId, roomId); 
      setRoom(updatedRoomData); 
      
      if (updatedRoomData && updatedRoomData.analyzedPhotoUrls) {
        await performFullRoomAnalysis(updatedRoomData.analyzedPhotoUrls);
      } else {
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
          onImageClick={(urls, index, isPending) => {
            openLightbox(urls, index, isPending);
          }}
        />
      </div>
       <ObjectAnalysisCard
         room={{...room, isAnalyzing: displayAnalyzing }}
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

      <ImageLightbox
        images={lightboxImages}
        currentIndex={lightboxCurrentIndex}
        isOpen={isLightboxOpen}
        onClose={closeLightbox}
        onNavigate={navigateLightbox}
      />
    </>
  );
}
