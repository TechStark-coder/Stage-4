
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getHome, getRoom, updateRoomAnalysisData, clearRoomAnalysisData, setRoomAnalyzingStatus } from "@/lib/firestore";
import type { Home, Room } from "@/types";
import { PhotoUploader } from "@/components/rooms/PhotoUploader";
import { ObjectAnalysisCard } from "@/components/rooms/ObjectAnalysisCard";
import { ImageGallery } from "@/components/rooms/ImageGallery";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, DoorOpen, Home as HomeIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAiAnalysisLoader } from "@/contexts/AiAnalysisLoaderContext";

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
  
  // State for photos selected in the current session, before analysis
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);

  const fetchRoomDetails = useCallback(async () => {
    if (user && homeId && roomId) {
      setPageLoading(true);
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
        setPageLoading(false);
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

  const handleAnalysisComplete = async (
    analysisSuccessful: boolean,
    objectNames?: string[],
    photoUrls?: string[]
  ) => {
    hideAiLoader(); // Hide loader regardless of success
    if (analysisSuccessful && objectNames && photoUrls && homeId && roomId) {
      try {
        await updateRoomAnalysisData(homeId, roomId, objectNames, photoUrls);
        toast({ title: "Analysis Complete", description: "Room analysis results have been updated." });
        setUploadedPhotos([]); // Clear pending photos from UI
      } catch (error) {
        console.error("Error updating room analysis data:", error);
        toast({ title: "Update Error", description: "Failed to save analysis results.", variant: "destructive" });
        // Photos remain in UI for retry if saving fails
      }
    } else if (!analysisSuccessful) {
      // Toast for AI failure is usually handled in PhotoUploader
      // Photos remain in UI for retry
    }
    fetchRoomDetails(); // Re-fetch to get the latest room data (including new analyzedPhotoUrls)
  };

  const handleClearResults = async () => {
    if (!homeId || !roomId) return;
    setPageLoading(true); 
    try {
      await clearRoomAnalysisData(homeId, roomId);
      toast({ title: "Results Cleared", description: "The object analysis results and stored images have been cleared." });
      setUploadedPhotos([]); // Clear any pending photos in UI as well
      fetchRoomDetails();
    } catch (error: any) {
      console.error("Failed to clear results:", error);
      toast({ title: "Error", description: "Failed to clear analysis results: " + error.message, variant: "destructive" });
    } finally {
      setPageLoading(false);
    }
  };

  if (pageLoading && !room) { // Initial page load skeleton
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

  return (
    <div className="space-y-8">
      <Button variant="outline" size="sm" asChild className="mb-6 bg-card/80 hover:bg-card">
        <Link href={`/homes/${homeId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to {home?.name || "Home"}
        </Link>
      </Button>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-card/70 rounded-lg shadow">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <DoorOpen className="h-8 w-8 text-primary" />
          {room.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Part of <HomeIcon className="inline h-4 w-4 mr-1" /> {home.name}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          <PhotoUploader
            homeId={homeId}
            roomId={roomId}
            userId={user?.uid || ""} // Pass userId for storage paths
            onAnalysisComplete={handleAnalysisComplete}
            currentPhotos={uploadedPhotos}
            onPhotosChange={handlePhotosChange}
          />
        </div>
        <div>
           <ImageGallery 
             pendingPhotos={uploadedPhotos} 
             analyzedPhotoUrls={room.analyzedPhotoUrls || []}
             onRemovePendingPhoto={handleRemovePendingPhoto} 
            />
        </div>
      </div>
       <ObjectAnalysisCard
         room={room}
         onClearResults={handleClearResults}
         homeName={home.name}
        />
    </div>
  );
}
