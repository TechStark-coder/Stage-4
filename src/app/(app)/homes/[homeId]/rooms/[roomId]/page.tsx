
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getHome, getRoom, clearRoomObjectNames } from "@/lib/firestore"; // Added clearRoomObjectNames
import type { Home, Room } from "@/types";
import { PhotoUploader } from "@/components/rooms/PhotoUploader";
import { ObjectAnalysisCard } from "@/components/rooms/ObjectDescriptionCard"; // Renamed
import { ImageGallery } from "@/components/rooms/ImageGallery"; // New
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, DoorOpen, Home as HomeIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RoomDetailPage() {
  const { user } = useAuthContext();
  const params = useParams();
  const homeId = params.homeId as string;
  const roomId = params.roomId as string;
  const { toast } = useToast();

  const [home, setHome] = useState<Home | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);

  const fetchRoomDetails = useCallback(async () => {
    if (user && homeId && roomId) {
      setLoading(true);
      try {
        const currentHome = await getHome(homeId);
        if (currentHome && currentHome.ownerId === user.uid) {
          setHome(currentHome);
          const currentRoom = await getRoom(homeId, roomId);
          setRoom(currentRoom);
        } else {
          setHome(null);
          setRoom(null);
        }
      } catch (error) {
        console.error("Failed to fetch room details:", error);
        toast({ title: "Error", description: "Failed to fetch room details.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  }, [user, homeId, roomId, toast]);

  useEffect(() => {
    fetchRoomDetails();
  }, [fetchRoomDetails]);

  const handlePhotosChange = (newPhotos: File[]) => {
    setUploadedPhotos(newPhotos);
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setUploadedPhotos(prevPhotos => prevPhotos.filter((_, index) => index !== indexToRemove));
  };
  
  const handleAnalysisComplete = ()_ => {
    fetchRoomDetails(); // Re-fetch to get updated objectNames and analyzing status
    // Photos are managed locally until analysis, no need to clear them here unless desired
  };

  const handleClearResults = async () => {
    if (!homeId || !roomId) return;
    try {
      await clearRoomObjectNames(homeId, roomId);
      toast({ title: "Results Cleared", description: "The object analysis results have been cleared." });
      fetchRoomDetails(); // Re-fetch to update UI
    } catch (error) {
      console.error("Failed to clear results:", error);
      toast({ title: "Error", description: "Failed to clear analysis results.", variant: "destructive" });
    }
  };

  if (loading) {
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
            onAnalysisComplete={handleAnalysisComplete}
            currentPhotos={uploadedPhotos}
            onPhotosChange={handlePhotosChange}
          />
        </div>
        <div>
            <ImageGallery photos={uploadedPhotos} onRemovePhoto={handleRemovePhoto} />
        </div>
      </div>
       <ObjectAnalysisCard room={room} onClearResults={handleClearResults} homeName={home.name} />
    </div>
  );
}
