
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuthContext";
import { Skeleton } from "@/components/ui/skeleton"; 

export default function HomePage() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  return (
     <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 p-8 rounded-lg shadow-lg bg-card w-full max-w-md text-center">
          <Skeleton className="h-12 w-12 mx-auto rounded-full bg-primary/20" />
          <Skeleton className="h-6 w-3/4 mx-auto bg-muted" />
          <Skeleton className="h-4 w-1/2 mx-auto bg-muted" />
          <p className="text-sm text-muted-foreground pt-2">Loading HomieStan...</p>
        </div>
      </div>
  );
}

