
"use client"; // This layout needs to be a client component to use hooks

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuthContext";
import { AppHeader } from "@/components/layout/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    // Show a loading state or a simple skeleton while checking auth / redirecting
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 w-full border-b bg-card">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
            <Skeleton className="h-8 w-32 bg-muted" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24 bg-muted" />
              <Skeleton className="h-8 w-24 bg-muted" />
            </div>
          </div>
        </header>
        <main className="flex-1 container mx-auto p-4 md:p-6">
          <Skeleton className="h-64 w-full bg-muted rounded-lg" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1 container mx-auto p-4 py-6 md:p-6 md:py-8">
        {children}
      </main>
    </div>
  );
}
