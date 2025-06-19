
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthContext } from "@/hooks/useAuthContext";
import { getHomes } from "@/lib/firestore";
import type { Home } from "@/types";
import { HomeCard } from "@/components/dashboard/HomeCard";
import { CreateHomeDialog } from "@/components/dashboard/CreateHomeDialog";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { Home as HomeIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuthContext(); // Renamed loading to authLoading for clarity
  const [homes, setHomes] = useState<Home[]>([]);
  const [pageLoading, setPageLoading] = useState(true); // Page-specific loading state
  const { toast } = useToast();

  const handleHomesUpdated = useCallback(async () => {
    if (user && user.uid) { // Ensure user and user.uid are available
      setPageLoading(true);
      try {
        const userHomes = await getHomes(user.uid);
        setHomes(userHomes);
      } catch (error) {
        console.error("Failed to fetch homes:", error);
        toast({
          title: "Error Loading Homes",
          description: (error instanceof Error ? error.message : String(error)) + ". Please try refreshing or check permissions.",
          variant: "destructive",
          duration: 7000,
        });
        setHomes([]); // Clear homes on error
      } finally {
        setPageLoading(false);
      }
    } else {
      // No user or user.uid, so clear homes and stop loading
      setHomes([]);
      setPageLoading(false);
    }
  }, [user, toast]); // Dependencies for useCallback

  useEffect(() => {
    // Only proceed if auth is no longer loading
    if (!authLoading) {
      if (user && user.uid) {
        // Welcome message logic
        const shouldShowWelcome = sessionStorage.getItem("showWelcomeOnLoad");
        if (shouldShowWelcome === "true") {
          const lastAuthAction = sessionStorage.getItem("lastAuthAction");
          const userName = user.displayName || user.email?.split('@')[0] || "User";
          let toastTitle = "Welcome Back!";
          let toastDescription = `Hello ${userName}, let's manage your homes.`;

          if (lastAuthAction === "signup") {
            toastTitle = "Welcome to HomieStan!";
            toastDescription = `Great to have you, ${userName}! Get started by creating your first home.`;
          }

          toast({
            title: toastTitle,
            description: toastDescription,
            duration: 7000,
          });

          sessionStorage.removeItem("showWelcomeOnLoad");
          sessionStorage.removeItem("lastAuthAction");
        }
        // Fetch homes
        handleHomesUpdated();
      } else {
        // No user is logged in (and auth is not loading), clear homes and ensure page is not "loading"
        setHomes([]);
        setPageLoading(false);
      }
    } else {
      // Auth is still loading, ensure page loading state reflects this
      setPageLoading(true);
    }
  }, [user, authLoading, toast, handleHomesUpdated]); // Dependencies for useEffect


  if (authLoading || pageLoading) { // Check both authLoading and page-specific loading
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
