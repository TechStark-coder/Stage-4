
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getHome, getRoom, updateRoomAnalysisData, clearRoomAnalysisData, removeAnalyzedRoomPhoto } from "@/lib/firestore";
import type { Home, Room } from "@/types";
import { PhotoUploader } from "@/components/rooms/PhotoUploader";
import { ObjectAnalysisCard } from "@/components/rooms/ObjectAnalysisCard";
import { ImageGallery } from "@/components/rooms/ImageGallery";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, DoorOpen, Home as HomeIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAiAnalysisLoader } from "@/contexts/AiAnalysisLoaderContext";
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

export default function RoomDetailPage() {
  const { user } = useAuthContext();
  const params = useParams();
  const homeId = params.homeId as string;
  const roomId = params.roomId as string;
  const { toast } = useToast();
  const { hideAiLoader } = useAiAnalysisLoader();

  const [home, setHome] = useState<Home | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);


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
    analyzedObjects?: Array<{ name: string; count: number }>,
    newlyUploadedPhotoUrls?: string[]
  ) => {
    hideAiLoader();
    if (analysisSuccessful && analyzedObjects && newlyUploadedPhotoUrls && homeId && roomId && user?.uid) {
      try {
        await updateRoomAnalysisData(homeId, roomId, analyzedObjects, newlyUploadedPhotoUrls, user.uid);
        toast({ title: "Analysis Complete", description: "Room analysis results have been updated." });
        setUploadedPhotos([]); 
      } catch (error) {
        console.error("Error updating room analysis data:", error);
        toast({ title: "Update Error", description: "Failed to save analysis results.", variant: "destructive" });
      }
    }
    fetchRoomDetails(); 
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
    try {
      await removeAnalyzedRoomPhoto(homeId, roomId, photoToDelete, user.uid);
      toast({ title: "Photo Deleted", description: "The photo has been removed, and the room's object analysis has been cleared. Re-analyze if needed.", duration: 7000 });
      fetchRoomDetails();
    } catch (error: any) {
      console.error("Failed to delete photo:", error);
      toast({ title: "Error Deleting Photo", description: error.message, variant: "destructive" });
    } finally {
      setPageLoading(false);
      setPhotoToDelete(null);
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
         room={room}
         onClearResults={handleClearResults}
         homeName={home.name}
        />
    </div>
    <AlertDialog open={!!photoToDelete} onOpenChange={(open) => !open && setPhotoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this photo? This will also clear the current object analysis for this room. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPhotoToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveAnalyzedPhoto} className="bg-destructive hover:bg-destructive/90">
              Delete Photo & Clear Analysis
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


    