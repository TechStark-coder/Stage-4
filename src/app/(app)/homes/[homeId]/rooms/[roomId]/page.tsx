
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getHome, getRoom, clearRoomObjectNames } from "@/lib/firestore";
import type { Home, Room } from "@/types";
import { PhotoUploader } from "@/components/rooms/PhotoUploader";
import { ObjectAnalysisCard } from "@/components/rooms/ObjectAnalysisCard";
import { ImageGallery } from "@/components/rooms/ImageGallery";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, DoorOpen, Home as HomeIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAiAnalysisLoader } from "@/contexts/AiAnalysisLoaderContext";

// Helper function to convert File to Data URL
const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

// Helper function to convert Data URL back to File
interface PersistedPhotoInfo {
  name: string;
  type: string;
  dataUrl: string;
}

const dataURLtoFile = (dataurl: string, filename: string, filetype?: string): File => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || filetype || 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};


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
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);

  const sessionStorageKey = roomId ? `pendingRoomPhotos_${roomId}` : null;

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

  useEffect(() => {
    if (sessionStorageKey && uploadedPhotos.length === 0) {
      const storedPhotosJson = sessionStorage.getItem(sessionStorageKey);
      if (storedPhotosJson) {
        try {
          const storedPhotosInfo: PersistedPhotoInfo[] = JSON.parse(storedPhotosJson);
          if (Array.isArray(storedPhotosInfo) && storedPhotosInfo.length > 0) {
            const reconstructedFiles = storedPhotosInfo.map(info =>
              dataURLtoFile(info.dataUrl, info.name, info.type)
            );
            setUploadedPhotos(reconstructedFiles);
          }
        } catch (e) {
          console.error("Error parsing photos from session storage:", e);
          sessionStorage.removeItem(sessionStorageKey);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);


  useEffect(() => {
    if (sessionStorageKey) {
      if (uploadedPhotos.length > 0) {
        const savePhotosToSession = async () => {
          try {
            const photosToStore: PersistedPhotoInfo[] = await Promise.all(
              uploadedPhotos.map(async (file) => {
                const dataUrl = await fileToDataURL(file);
                return { name: file.name, type: file.type, dataUrl };
              })
            );
            try {
              sessionStorage.setItem(sessionStorageKey, JSON.stringify(photosToStore));
            } catch (e: any) {
              if (e.name === 'QuotaExceededError') {
                console.warn("Session storage quota exceeded. Pending photos might not persist on page reload/navigation.", e);
                toast({
                  title: "Storage Warning",
                  description: "Too many/large photos selected. They may not be saved if you navigate away before analysis. Please consider reducing the number of photos.",
                  variant: "default",
                  duration: 7000,
                });
              } else {
                console.error("Error saving photos to session storage:", e);
              }
            }
          } catch (error) {
            console.error("Error preparing photos for session storage:", error);
          }
        };
        savePhotosToSession();
      } else {
        sessionStorage.removeItem(sessionStorageKey);
      }
    }
  }, [uploadedPhotos, sessionStorageKey, toast]);


  const handlePhotosChange = (newPhotos: File[]) => {
    setUploadedPhotos(newPhotos);
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setUploadedPhotos(prevPhotos => prevPhotos.filter((_, index) => index !== indexToRemove));
  };

  const handleAnalysisInitiated = () => {
    showAiLoader();
  };

  const handleAnalysisComplete = (analysisSuccessful: boolean) => {
    hideAiLoader();
    fetchRoomDetails();
    if (analysisSuccessful) {
      if (sessionStorageKey) {
        sessionStorage.removeItem(sessionStorageKey);
      }
      setUploadedPhotos([]);
    }
  };

  const handleClearResults = async () => {
    if (!homeId || !roomId) return;
    setPageLoading(true); // Using pageLoading for this general action
    try {
      await clearRoomObjectNames(homeId, roomId);
      toast({ title: "Results Cleared", description: "The object analysis results have been cleared." });
      fetchRoomDetails();
    } catch (error) {
      console.error("Failed to clear results:", error);
      toast({ title: "Error", description: "Failed to clear analysis results.", variant: "destructive" });
    } finally {
      setPageLoading(false);
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
            onAnalysisInitiated={handleAnalysisInitiated}
            onAnalysisComplete={handleAnalysisComplete}
            currentPhotos={uploadedPhotos}
            onPhotosChange={handlePhotosChange}
          />
        </div>
        <div>
            <ImageGallery photos={uploadedPhotos} onRemovePhoto={handleRemovePhoto} />
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
