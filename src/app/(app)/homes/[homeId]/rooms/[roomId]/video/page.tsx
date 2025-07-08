
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
import { ArrowLeft, Video, Home as HomeIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { describeRoomObjectsFromVideo } from "@/ai/flows/describe-room-objects-from-video";
import type { DescribeRoomObjectsOutput } from "@/ai/flows/describe-room-objects-from-video";
import { useVideoAnalysis } from "@/contexts/VideoAnalysisContext";

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
  
  const { videoFile, analysisResult } = getRoomState(roomId) || { videoFile: null, analysisResult: null };

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

  const handleVideoChange = (file: File | null) => {
    setRoomState(roomId, { videoFile: file, analysisResult: null });
  };

  const handleAnalyzeVideo = async (fileToAnalyze: File) => {
    if (!fileToAnalyze) {
      toast({
        title: 'No Video',
        description: 'Please select a video to analyze.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    setRoomState(roomId, { analysisResult: null });
    toast({
      title: 'Starting Analysis',
      description: 'Preparing video... This can take a moment for large files.',
    });

    try {
      const videoDataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(fileToAnalyze);
      });

      toast({
        title: 'Analyzing Video',
        description: 'AI is now processing your video. Please wait.',
      });
      const result = await describeRoomObjectsFromVideo({ videoDataUri });

      if (result && result.objects) {
        setRoomState(roomId, { analysisResult: result });
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
      setRoomState(roomId, { analysisResult: null });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleClearResults = () => {
    clearRoomState(roomId);
    toast({ title: "Results Cleared", description: "Ready for a new video analysis."});
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

  return (
    <div className="space-y-8">
      <Button variant="ghost" size="sm" asChild className="mb-2 hover:bg-accent">
        <Link href={`/homes/${homeId}/rooms/${roomId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to {room.name}
        </Link>
      </Button>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-card/70 rounded-lg shadow">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Video className="h-8 w-8 text-primary" />
          Video Analysis for: {room.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Part of <HomeIcon className="inline h-4 w-4 mr-1" /> {home.name}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <VideoUploader
          onVideoChange={handleVideoChange}
          onAnalyze={handleAnalyzeVideo}
          isAnalyzing={isAnalyzing}
          videoFile={videoFile}
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
