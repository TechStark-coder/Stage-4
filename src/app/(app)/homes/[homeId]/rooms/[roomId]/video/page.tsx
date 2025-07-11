
"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getHome, getRoom } from "@/lib/firestore";
import type { Home, Room } from "@/types";
import { VideoUploader } from "@/components/rooms/VideoUploader";
import { VideoAnalysisCard } from "@/components/rooms/VideoAnalysisCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Video, Home as HomeIcon, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { describeRoomObjectsFromVideo } from "@/ai/flows/describe-room-objects-from-video";
import { useVideoAnalysis } from "@/contexts/VideoAnalysisContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export default function VideoAnalysisPage() {
  const { user } = useAuthContext();
  const params = useParams();
  const homeId = params.homeId as string;
  const roomId = params.roomId as string;
  const { toast } = useToast();
  const { getRoomState, setRoomState, clearRoomState } = useVideoAnalysis();

  const [home, setHome] = useState<Home | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  
  // Directly use the state from context. It now handles persistence.
  const { videoFiles, analysisResult } = getRoomState(roomId) || { videoFiles: [], analysisResult: null };

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchDetails = useCallback(async () => {
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
        console.error("Failed to fetch details:", error);
        toast({ title: "Error", description: "Failed to fetch room details.", variant: "destructive" });
      } finally {
        setPageLoading(false);
      }
    }
  }, [user, homeId, roomId, toast]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleVideoChange = (files: File[]) => {
    // When files are changed, we keep the old analysis result for now
    setRoomState(roomId, { videoFiles: files });
  };

  const handleAnalyzeVideo = async (filesToAnalyze: File[]) => {
    if (!filesToAnalyze || filesToAnalyze.length === 0) {
      toast({
        title: 'No Videos',
        description: 'Please select one or more videos to analyze.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    // Clear previous results before starting a new analysis
    setRoomState(roomId, { videoFiles: filesToAnalyze, analysisResult: null });
    toast({
      title: 'Starting Analysis',
      description: 'Preparing videos... This can take a moment for large files.',
    });

    try {
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

      toast({
        title: 'Analyzing Videos',
        description: `AI is now processing your ${videoDataUris.length} video(s). Please wait.`,
      });
      const result = await describeRoomObjectsFromVideo({ videoDataUris });

      if (result && result.objects) {
        // Save the new result, keeping the files that were analyzed
        setRoomState(roomId, { videoFiles: filesToAnalyze, analysisResult: result });
        toast({
          title: 'Analysis Complete!',
          description: `Found ${result.objects.length} types of objects.`,
        });
      } else {
        throw new Error(
          'AI analysis did not return the expected object structure.'
        );
      }
    } catch (error: any) {
      console.error('Error during video analysis:', error);
      toast({
        title: 'Analysis Failed',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
      // On failure, keep the files but clear the result
      setRoomState(roomId, { videoFiles: filesToAnalyze, analysisResult: null });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleClearResults = () => {
    clearRoomState(roomId);
    toast({ title: "Results & Selection Cleared", description: "Ready for a new video analysis."});
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

  // Determine if there are persisted results but no files (after a refresh)
  const hasPersistedResults = analysisResult && videoFiles.length === 0;

  return (
    <div className="space-y-8">
      <Button variant="ghost" size="sm" asChild className="mb-2 hover:bg-accent -ml-2 sm:ml-0">
        <Link href={`/homes/${homeId}/rooms/${roomId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to {room.name}
        </Link>
      </Button>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-card/70 rounded-lg shadow">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Video className="h-8 w-8 text-primary" />
          Video Analysis for: {room.name}
        </h1>
        <p className="text-sm text-muted-foreground text-left sm:text-right">
          Part of <HomeIcon className="inline h-4 w-4 mr-1" /> {home.name}
        </p>
      </div>

      {hasPersistedResults && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Viewing Previous Analysis</AlertTitle>
          <AlertDescription>
            Showing results from your last analysis. To re-analyze or analyze new videos, please select the video files again.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <VideoUploader
          onVideoChange={handleVideoChange}
          onAnalyze={handleAnalyzeVideo}
          isAnalyzing={isAnalyzing}
          videoFiles={videoFiles || []}
        />
        <VideoAnalysisCard
          analysisResult={analysisResult}
          isAnalyzing={isAnalyzing}
          onClearResults={handleClearResults}
          title={`${home.name} - ${room.name} (Video Analysis)`}
        />
      </div>
    </div>
  );
}
