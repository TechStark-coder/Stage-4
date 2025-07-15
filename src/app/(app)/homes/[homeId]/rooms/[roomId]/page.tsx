
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getHome, getRoom, updateRoomAnalysisData, clearRoomAnalysisData, removeAnalyzedRoomPhoto, setRoomAnalyzingStatus } from "@/lib/firestore";
import type { Home, Room, DescribeRoomObjectsOutput } from "@/types";
import { MediaUploader } from "@/components/rooms/MediaUploader";
import { ObjectAnalysisCard } from "@/components/rooms/ObjectAnalysisCard";
import { ImageGallery } from "@/components/rooms/ImageGallery";
import { ImageLightbox } from "@/components/rooms/ImageLightbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, DoorOpen, Home as HomeIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAiAnalysisLoader } from "@/contexts/AiAnalysisLoaderContext";
import { describeRoomObjects } from "@/ai/flows/describe-room-objects";
import { describeRoomObjectsFromVideo } from "@/ai/flows/describe-room-objects-from-video";
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
import { storage } from "@/config/firebase";
import { ref, getDownloadURL, uploadBytes } from "firebase/storage";

export default function RoomDetailPage() {
  const { user } = useAuthContext();
  const params = useParams();
  const homeId = params.homeId as string;
  const roomId = params.roomId as string;
  const { toast } = useToast();
  const { showAiLoader, hideAiLoader, isAiAnalyzing: isGlobalAiAnalyzing } = useAiAnalysisLoader();

  const [home, setHome] = useState<Home | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  
  const [mediaToUpload, setMediaToUpload] = useState<File[]>([]);
  const [mediaToDelete, setMediaToDelete] = useState<{url: string; isAnalyzed: boolean} | null>(null);

  // State for lightbox
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxCurrentIndex, setLightboxCurrentIndex] = useState<number | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isLightboxForVideo, setIsLightboxForVideo] = useState(false);


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
  const openLightbox = (urls: string[], startIndex: number, isVideo: boolean = false) => {
    setLightboxImages(urls);
    setLightboxCurrentIndex(startIndex);
    setIsLightboxForVideo(isVideo);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    setTimeout(() => {
        setLightboxCurrentIndex(null);
        setLightboxImages([]);
        setIsLightboxForVideo(false);
    }, 300);
  };

  const navigateLightbox = ( (newIndex: number) => {
    if (newIndex >= 0 && newIndex < lightboxImages.length) {
      setLightboxCurrentIndex(newIndex);
    }
  });


  const handleFilesChange = (newFiles: File[]) => {
    setMediaToUpload(newFiles);
  };

  const handleRemovePendingMedia = (indexToRemove: number) => {
    setMediaToUpload(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  const handleClearPendingMedia = () => {
    setMediaToUpload([]);
  };
  
  const performFullRoomAnalysis = async (photoUrlsToAnalyze: string[], videoUrlsToAnalyze: string[]) => {
     if (!homeId || !roomId || !user?.uid) {
      toast({ title: "Error", description: "Cannot perform analysis. Missing required information.", variant: "destructive" });
      return;
    }
    
    // If there's nothing left to analyze, just clear the results in Firestore.
    if (photoUrlsToAnalyze.length === 0 && videoUrlsToAnalyze.length === 0) {
      try {
        await clearRoomAnalysisData(homeId, roomId, user.uid);
        toast({ title: "Analysis Cleared", description: "No media remaining. Object analysis for the room has been cleared." });
        fetchRoomDetails(false);
      } catch (error) {
        console.error("Error clearing room analysis data:", error);
        toast({ title: "Update Error", description: "Failed to clear analysis results.", variant: "destructive" });
      }
      return;
    }
    
    showAiLoader();
    try {
      await setRoomAnalyzingStatus(homeId, roomId, true);
      fetchRoomDetails(false); 
      toast({ title: "Full Room Re-analysis", description: `Analyzing all ${photoUrlsToAnalyze.length} photos and ${videoUrlsToAnalyze.length} videos... This may take a moment.`, duration: 5000 });

      let photoResults: DescribeRoomObjectsOutput = { objects: [] };
      let videoResults: DescribeRoomObjectsOutput = { objects: [] };
      
      if (photoUrlsToAnalyze.length > 0) {
        photoResults = await describeRoomObjects({ photoDataUris: photoUrlsToAnalyze });
      }
      if (videoUrlsToAnalyze.length > 0) {
        const videoDataUrisToAnalyze = await Promise.all(
          videoUrlsToAnalyze.map(async (url) => {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          })
        );
        videoResults = await describeRoomObjectsFromVideo({ videoDataUris: videoDataUrisToAnalyze });
      }

      // Merge results
      const mergedObjectsMap = new Map<string, number>();
      const nameMap = new Map<string, string>();
      const allObjects = [...(photoResults.objects || []), ...(videoResults.objects || [])];

      allObjects.forEach(obj => {
          const key = obj.name.toLowerCase().trim();
          const currentCount = mergedObjectsMap.get(key) || 0;
          mergedObjectsMap.set(key, currentCount + obj.count);
          if (!nameMap.has(key)) {
              nameMap.set(key, obj.name);
          }
      });
      const finalObjects = {
          objects: Array.from(mergedObjectsMap.entries()).map(([key, count]) => ({
              name: nameMap.get(key)!,
              count: count
          })).sort((a, b) => a.name.localeCompare(b.name))
      };

      await updateRoomAnalysisData(homeId, roomId, finalObjects, photoUrlsToAnalyze, videoUrlsToAnalyze);
      toast({ title: "Room Re-analysis Complete!", description: "The object list for the room has been updated." });
      
      fetchRoomDetails(false); 
    } catch (error: any) {
      console.error("Error during full room re-analysis:", error);
      toast({ title: "Re-analysis Failed", description: error.message || "Could not re-analyze room objects.", variant: "destructive" });
    } finally {
      await setRoomAnalyzingStatus(homeId, roomId, false);
      hideAiLoader();
      fetchRoomDetails(false);
    }
  };


  const handleAnalysisComplete = async () => {
    if (!user || !mediaToUpload || mediaToUpload.length === 0) {
      toast({ title: 'No Media', description: 'Please select one or more files to analyze.', variant: 'destructive' });
      return;
    }
    
    showAiLoader();
    let uploadedPhotoUrls: string[] = [];
    let uploadedVideoUrls: string[] = [];
    let videoDataUris: string[] = [];

    try {
        await setRoomAnalyzingStatus(homeId, roomId, true);
        fetchRoomDetails(false);

        toast({ title: 'Uploading Media...', description: 'Preparing files for analysis.' });

        const uploadPromises = mediaToUpload.map(async file => {
            const isVideo = file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mov');
            const uniqueFileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
            const path = `roomAnalysis/${user.uid}/${roomId}/${uniqueFileName}`;
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            if (isVideo) {
                uploadedVideoUrls.push(downloadURL);
                const dataUri = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = (error) => reject(error);
                  reader.readAsDataURL(file);
                });
                videoDataUris.push(dataUri);
            } else {
                uploadedPhotoUrls.push(downloadURL);
            }
        });
        await Promise.all(uploadPromises);

        toast({ title: 'Analyzing Media', description: `AI is now processing ${mediaToUpload.length} file(s). Please wait.` });

        let photoResults: DescribeRoomObjectsOutput = { objects: [] };
        let videoResults: DescribeRoomObjectsOutput = { objects: [] };

        if (uploadedPhotoUrls.length > 0) {
            photoResults = await describeRoomObjects({ photoDataUris: uploadedPhotoUrls });
        }
        if (uploadedVideoUrls.length > 0) {
            videoResults = await describeRoomObjectsFromVideo({ videoDataUris });
        }

        const existingObjects = room?.analyzedObjects || [];
        const newAnalysisObjects = [...(photoResults.objects || []), ...(videoResults.objects || [])];
        
        const mergedObjectsMap = new Map<string, number>();
        const nameMap = new Map<string, string>();

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
                nameMap.set(key, newObj.name);
            }
        });

        const finalObjects = {
            objects: Array.from(mergedObjectsMap.entries()).map(([key, count]) => ({
                name: nameMap.get(key)!,
                count: count
            })).sort((a, b) => a.name.localeCompare(b.name))
        };

        const finalPhotoUrls = Array.from(new Set([...(room?.analyzedPhotoUrls || []), ...uploadedPhotoUrls]));
        const finalVideoUrls = Array.from(new Set([...(room?.analyzedVideoUrls || []), ...uploadedVideoUrls]));

        await updateRoomAnalysisData(homeId, roomId, finalObjects, finalPhotoUrls, finalVideoUrls);
        toast({ title: 'Analysis Complete!', description: `Found ${newAnalysisObjects.length} new types of objects.` });
        
    } catch (error: any) {
        console.error('Error during media analysis:', error);
        toast({ title: 'Analysis Failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
        setMediaToUpload([]); // Clear pending files
        await setRoomAnalyzingStatus(homeId, roomId, false);
        hideAiLoader();
        fetchRoomDetails(false);
    }
  };

  const handleClearAnalyzedResults = async () => {
    if (!homeId || !roomId || !user?.uid) {
        toast({ title: "Error", description: "Cannot clear results. Missing required information.", variant: "destructive" });
        return;
    }
    showAiLoader();
    try {
        await clearRoomAnalysisData(homeId, roomId, user.uid);
        toast({ title: "Results Cleared", description: "The analysis results and stored media have been cleared." });
        fetchRoomDetails(false);
    } catch (error: any) {
        console.error("Failed to clear results:", error);
        toast({ title: "Error", description: "Failed to clear analysis results: " + error.message, variant: "destructive" });
    } finally {
        hideAiLoader();
    }
  };

  const confirmRemoveMedia = async () => {
    if (!mediaToDelete || !homeId || !roomId || !user?.uid) {
      toast({ title: "Error", description: "Cannot delete media. Missing required information.", variant: "destructive" });
      setMediaToDelete(null);
      return;
    }
    
    if (mediaToDelete.isAnalyzed) {
        let mediaSuccessfullyRemoved = false;
        showAiLoader();
        try {
          await removeAnalyzedRoomPhoto(homeId, roomId, mediaToDelete.url, user.uid);
          toast({ title: "Media Removed", description: "Media deleted. Re-analyzing remaining files..." });
          mediaSuccessfullyRemoved = true;
        } catch (error: any) {
          console.error("Failed to delete media from Firestore/Storage:", error);
          toast({ title: "Error Deleting Media", description: error.message, variant: "destructive" });
        } finally {
          setMediaToDelete(null); 
          hideAiLoader();
        }

        if (mediaSuccessfullyRemoved) {
          const updatedRoomData = await getRoom(homeId, roomId); 
          setRoom(updatedRoomData); 
          
          if (updatedRoomData) {
            await performFullRoomAnalysis(updatedRoomData.analyzedPhotoUrls || [], updatedRoomData.analyzedVideoUrls || []);
          } else {
            // This case might occur if the room was deleted in another tab.
            await performFullRoomAnalysis([], []);
          }
        }
    } else {
        // This is a pending file, just remove it from the state
        const urlToRemove = mediaToDelete.url;
        setMediaToUpload(prevFiles => {
            const indexToRemove = prevFiles.findIndex(file => URL.createObjectURL(file) === urlToRemove);
            if(indexToRemove > -1) {
                return prevFiles.filter((_, i) => i !== indexToRemove);
            }
            return prevFiles;
        });
        URL.revokeObjectURL(urlToRemove); // Clean up object URL
        setMediaToDelete(null);
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
      <div className="text-center py-12 px-4">
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

  const displayAnalyzing = isGlobalAiAnalyzing || room.isAnalyzing;

  return (
    <>
    <div className="space-y-8">
       <div className="flex flex-col sm:flex-row justify-between items-center mb-2 gap-2">
         <Button variant="ghost" size="sm" asChild className="hover:bg-accent -ml-2 sm:ml-0">
          <Link href={`/homes/${homeId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to {home?.name || "Home"}
          </Link>
        </Button>
       </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-card/70 rounded-lg shadow">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <DoorOpen className="h-8 w-8 text-primary" />
          {room.name}
        </h1>
        <p className="text-sm text-muted-foreground text-left sm:text-right">
          Part of <HomeIcon className="inline h-4 w-4 mr-1" /> {home.name}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start lg:h-[500px]">
        <MediaUploader
          onAnalysisComplete={handleAnalysisComplete}
          currentFiles={mediaToUpload}
          onFilesChange={handleFilesChange}
          isAnalyzing={!!displayAnalyzing}
          userId={user?.uid || ""}
          onClearPendingMedia={handleClearPendingMedia}
        />
        <ObjectAnalysisCard
          room={{...room, isAnalyzing: !!displayAnalyzing }}
          onClearResults={handleClearAnalyzedResults}
          homeName={home.name}
        />
      </div>

       <ImageGallery 
          pendingFiles={mediaToUpload}
          analyzedPhotoUrls={room.analyzedPhotoUrls || []}
          analyzedVideoUrls={room.analyzedVideoUrls || []}
          onRemovePendingMedia={handleRemovePendingMedia}
          onRemoveAnalyzedMedia={(url) => setMediaToDelete({url, isAnalyzed: true})}
          onMediaClick={(urls, index, isVideo) => {
            openLightbox(urls, index, isVideo);
          }}
          onClearPendingMedia={handleClearPendingMedia}
          onClearAnalyzedMedia={handleClearAnalyzedResults}
        />

    </div>
    <AlertDialog open={!!mediaToDelete} onOpenChange={(open) => !open && setMediaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete Media</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this file? 
              {mediaToDelete?.isAnalyzed && " This will remove the file and trigger a re-analysis of the remaining media for this room. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMediaToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveMedia} className="bg-destructive hover:bg-destructive/90">
              {mediaToDelete?.isAnalyzed ? 'Delete & Re-analyze' : 'Delete'}
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
        isVideos={isLightboxForVideo}
      />
    </>
  );
}
