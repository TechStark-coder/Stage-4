
"use client";

import { useEffect, useState } from "react";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getHomes } from "@/lib/firestore";
import type { Home } from "@/types";
import { HomeCard } from "@/components/dashboard/HomeCard";
import { CreateHomeDialog } from "@/components/dashboard/CreateHomeDialog";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { Home as HomeIcon } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuthContext();
  const [homes, setHomes] = useState<Home[]>([]);
  const [loading, setLoading] = useState(true);

  // Renamed from fetchHomes to handleHomesUpdated for clarity
  const handleHomesUpdated = async () => {
    if (user) {
      setLoading(true);
      try {
        const userHomes = await getHomes(user.uid);
        setHomes(userHomes);
      } catch (error) {
        console.error("Failed to fetch homes:", error);
        // Optionally, show a toast message
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    handleHomesUpdated();
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <HomeIcon className="h-8 w-8 text-primary" />
          My Homes
        </h1>
        <CreateHomeDialog onHomeCreated={handleHomesUpdated} />
      </div>

      {homes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-card">
          <Image
            src="https://placehold.co/300x200.png"
            alt="Empty state placeholder"
            width={300}
            height={200}
            className="mx-auto mb-6 rounded-md opacity-70"
            data-ai-hint="empty house illustration"
          />
          <h2 className="text-2xl font-semibold mb-2 text-foreground">No Homes Yet!</h2>
          <p className="text-muted-foreground mb-6">
            Get started by creating your first home.
          </p>
          <CreateHomeDialog onHomeCreated={handleHomesUpdated} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {homes.map((home) => (
            <HomeCard key={home.id} home={home} onHomeAction={handleHomesUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}
