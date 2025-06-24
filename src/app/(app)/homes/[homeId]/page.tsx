
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getHome, getRooms } from "@/lib/firestore";
import type { Home, Room } from "@/types";
import { RoomCard } from "@/components/homes/RoomCard";
import { CreateRoomDialog } from "@/components/homes/CreateRoomDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { ArrowLeft, DoorOpen, Home as HomeIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function HomeDetailPage() {
  const { user } = useAuthContext();
  const params = useParams();
  const homeId = params.homeId as string;
  const { toast } = useToast();

  const [home, setHome] = useState<Home | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHomeAndRooms = useCallback(async () => {
    if (user && homeId) {
      setLoading(true);
      try {
        const currentHome = await getHome(homeId);
        if (currentHome && currentHome.ownerId === user.uid) {
          setHome(currentHome);
          const homeRooms = await getRooms(homeId);
          setRooms(homeRooms);
        } else {
          setHome(null);
          setRooms([]);
          toast({ title: "Access Denied", description: "Home not found or you do not have access.", variant: "destructive" });
        }
      } catch (error) {
        console.error("Failed to fetch home details:", error);
        toast({ title: "Error", description: "Failed to fetch home details.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  }, [user, homeId, toast]);

  useEffect(() => {
    fetchHomeAndRooms();
  }, [fetchHomeAndRooms]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-20 mb-4" /> {/* Back button skele */}
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-60 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!home) {
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
        <h2 className="text-2xl font-semibold mb-2">Home Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The home you are looking for does not exist or you may not have access.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>
      </div>


      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <HomeIcon className="h-8 w-8 text-primary" />
          {home.name} - Rooms
        </h1>
        <CreateRoomDialog homeId={homeId} onRoomCreated={fetchHomeAndRooms} />
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-card">
          <DoorOpen className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No Rooms Yet!</h2>
          <p className="text-muted-foreground mb-6">
            Add rooms to this home to start analyzing objects.
          </p>
          <CreateRoomDialog homeId={homeId} onRoomCreated={fetchHomeAndRooms} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              homeId={homeId}
              homeName={home.name} // Pass homeName for PDF title in RoomCard
              onRoomAction={fetchHomeAndRooms} // Corrected prop name
            />
          ))}
        </div>
      )}
    </div>
  );
}
