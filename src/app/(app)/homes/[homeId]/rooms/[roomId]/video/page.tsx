
"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getHome, getRoom, clearRoomVideoAnalysisData, setRoomVideoAnalyzingStatus, updateRoomVideoAnalysisData } from "@/lib/firestore";
import type { Home, Room, DescribeRoomObjectsOutput } from "@/types";
import { VideoUploader } from "@/components/rooms/VideoUploader";
import { VideoAnalysisCard } from "@/components/rooms/VideoAnalysisCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Video, Home as HomeIcon, Info, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { describeRoomObjectsFromVideo } from "@/ai/flows/describe-room-objects-from-video";
import { useAiAnalysisLoader } from "@/contexts/AiAnalysisLoaderContext";
import { storage } from "@/config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ImageGallery } from "@/components/rooms/ImageGallery";
import { ImageLightbox } from "@/components/rooms/ImageLightbox";


export default function VideoAnalysisPage() {
  const { user } = useAuthContext();
  const params = useParams();
  const router = useRouter();
  const homeId = params.homeId as string;
  const roomId = params.roomId as string;
  const { toast } = useToast();
  const { showAiLoader, hideAiLoader } = useAiAnalysisLoader();

  const [home, setHome] = useState<Home | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // For lightbox
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fetchDetails = useCallback(async (showLoadingIndicator = true) => {
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
        console.error("Failed to fetch details:", error);
        toast({ title: "Error", description: "Failed to fetch room details.", variant: "destructive" });
      } finally {
        if (showLoadingIndicator) setPageLoading(false);
      }
    }
  }, [user, homeId, roomId, toast]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Lightbox handlers
  const handleOpenLightbox = (index: number) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };
  
  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
  };

  const handleNavigateLightbox = (newIndex: number) => {
    if (room?.analyzedVideoUrls && newIndex >= 0 && newIndex < room.analyzedVideoUrls.length) {
      setLightboxIndex(newIndex);
    }
  };

  const handleAnalyzeVideo = async (filesToAnalyze: File[]) => {
    if (!user || !filesToAnalyze || filesToAnalyze.length === 0) {
      toast({ title: 'No Videos', description: 'Please select one or more videos to analyze.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    showAiLoader();
    let uploadedUrls: string[] = [];

    try {
      await setRoomVideoAnalyzingStatus(homeId, roomId, true);
      fetchDetails(false); // Refresh UI to show analyzing state

      toast({ title: 'Uploading Videos...', description: 'Preparing videos for analysis.' });

      uploadedUrls = await Promise.all(
        filesToAnalyze.map(async file => {
          const uniqueFileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
          const videoPath = `roomAnalysisVideos/${user.uid}/${roomId}/${uniqueFileName}`;
          const storageRef = ref(storage, videoPath);
          await uploadBytes(storageRef, file);
          return await getDownloadURL(storageRef);
        })
      );
      
      const videoDataUris = await Promise.all(
        filesToAnalyze.map(file => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
          });
        })
      );


      toast({ title: 'Analyzing Videos', description: `AI is now processing ${uploadedUrls.length} video(s). Please wait.` });
      const result = await describeRoomObjectsFromVideo({ videoDataUris });

      if (result && result.objects) {
        // Merge with existing results if any
        const existingResult = room?.videoAnalysisResult?.objects || [];
        const mergedObjectsMap = new Map<string, number>();
        const nameMap = new Map<string, string>();

        existingResult.forEach(obj => {
            const key = obj.name.toLowerCase().trim();
            mergedObjectsMap.set(key, obj.count);
            nameMap.set(key, obj.name);
        });

        result.objects.forEach(newObj => {
            const key = newObj.name.toLowerCase().trim();
            const currentCount = mergedObjectsMap.get(key) || 0;
            mergedObjectsMap.set(key, currentCount + newObj.count);
            if (!nameMap.has(key)) {
                nameMap.set(key, newObj.name);
            }
        });

        const finalObjects: DescribeRoomObjectsOutput = {
            objects: Array.from(mergedObjectsMap.entries()).map(([key, count]) => ({
                name: nameMap.get(key)!,
                count: count
            })).sort((a, b) => a.name.localeCompare(b.name))
        };

        await updateRoomVideoAnalysisData(homeId, roomId, finalObjects, uploadedUrls, user.uid);
        toast({ title: 'Analysis Complete!', description: `Found ${result.objects.length} new types of objects.` });
      } else {
        throw new Error('AI analysis did not return the expected object structure.');
      }
    } catch (error: any) {
      console.error('Error during video analysis:', error);
      toast({ title: 'Analysis Failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
      await setRoomVideoAnalyzingStatus(homeId, roomId, false);
    } finally {
      setIsProcessing(false);
      hideAiLoader();
      fetchDetails(false); // Refresh to show final state
    }
  };
  
  const handleClearResults = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await clearRoomVideoAnalysisData(homeId, roomId, user.uid);
      toast({ title: "Results & Videos Cleared", description: "Ready for a new video analysis." });
    } catch (error: any) {
      toast({ title: "Error", description: `Could not clear results: ${error.message}`, variant: "destructive" });
    } finally {
      setIsProcessing(false);
      fetchDetails(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-10 w-72 mb-6" />
        <div className="grid lg:grid-cols-2 gap-8">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
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

  const displayAnalyzing = room.isVideoAnalyzing || isProcessing;

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-2 gap-2">
            <Button variant="ghost" size="sm" asChild className="hover:bg-accent -ml-2 sm:ml-0">
                <Link href={`/homes/${homeId}/rooms/${roomId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to {room.name} (Photos)
                </Link>
            </Button>
        </div>


        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-card/70 rounded-lg shadow">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Video className="h-8 w-8 text-primary" />
            Video Analysis for: {room.name}
          </h1>
          <p className="text-sm text-muted-foreground text-left sm:text-right">
            Part of <HomeIcon className="inline h-4 w-4 mr-1" /> {home.name}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <VideoUploader
            onAnalyze={handleAnalyzeVideo}
            isAnalyzing={displayAnalyzing}
          />
          <VideoAnalysisCard
            analysisResult={room.videoAnalysisResult}
            isAnalyzing={displayAnalyzing}
            onClearResults={handleClearResults}
            title={`${home.name} - ${room.name} (Video Analysis)`}
            lastAnalyzedAt={room.lastVideoAnalyzedAt}
          />
        </div>

        {room.analyzedVideoUrls && room.analyzedVideoUrls.length > 0 && (
           <ImageGallery 
              analyzedPhotoUrls={room.analyzedVideoUrls}
              galleryTitle="Analyzed Videos"
              emptyStateMessage="No videos have been analyzed for this room yet."
              onImageClick={handleOpenLightbox}
              isVideos={true}
            />
        )}
      </div>

      <ImageLightbox
        images={room.analyzedVideoUrls || []}
        currentIndex={lightboxIndex}
        isOpen={isLightboxOpen}
        onClose={handleCloseLightbox}
        onNavigate={handleNavigateLightbox}
        isVideos={true}
      />
    </>
  );
}
