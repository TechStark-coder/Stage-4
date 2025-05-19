
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getHome, getRoom } from "@/lib/firestore";
import type { Home, Room } from "@/types";
import { PhotoUploader } from "@/components/rooms/PhotoUploader";
import { ObjectDescriptionCard } from "@/components/rooms/ObjectDescriptionCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { ArrowLeft, DoorOpen, Home as HomeIcon } from "lucide-react";

export default function RoomDetailPage() {
  const { user } = useAuthContext();
  const params = useParams();
  const homeId = params.homeId as string;
  const roomId = params.roomId as string;

  const [home, setHome] = useState<Home | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);

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
          // console.error("Home/Room not found or access denied");
        }
      } catch (error) {
        console.error("Failed to fetch room details:", error);
      } finally {
        setLoading(false);
      }
    }
  }, [user, homeId, roomId]);

  useEffect(() => {
    fetchRoomDetails();
  }, [fetchRoomDetails]);

  const handleAnalysisComplete = () => {
    // Re-fetch room details to update the object description and analyzing status
    fetchRoomDetails();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40 mb-4" /> {/* Back button skele */}
        <Skeleton className="h-10 w-72 mb-6" /> {/* Title skele */}
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!home || !room) {
    return (
      <div className="text-center py-12">
        <Image
          src="https://placehold.co/300x200.png"
          alt="Not found placeholder"
          width={300}
          height={200}
          className="mx-auto mb-6 rounded-md opacity-70"
          data-ai-hint="error sad face"
        />
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
      <Button variant="outline" size="sm" asChild className="mb-6">
        <Link href={`/homes/${homeId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to {home?.name || "Home"}
        </Link>
      </Button>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <DoorOpen className="h-8 w-8 text-primary" />
          {room.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Part of <HomeIcon className="inline h-4 w-4 mr-1" /> {home.name}
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <PhotoUploader homeId={homeId} roomId={roomId} onAnalysisComplete={handleAnalysisComplete} />
        <ObjectDescriptionCard room={room} />
      </div>
    </div>
  );
}
