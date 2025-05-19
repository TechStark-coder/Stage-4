
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/config/firebase";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Aperture, LogOut } from "lucide-react";
import { useAuthContext } from "@/hooks/useAuthContext";

export function AppHeader() {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuthContext();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push("/login");
    } catch (error: any) {
      toast({ title: "Logout Failed", description: error.message, variant: "destructive" });
    }
  };

  const userName = user?.displayName || user?.email?.split('@')[0] || "User";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center px-4 md:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-xl font-semibold text-primary">
          <Aperture className="h-7 w-7" />
          <span>ARC Stay</span>
        </Link>
        <div className="flex-grow text-center">
          {user && (
            <span className="text-sm font-medium text-foreground sm:text-base">
              Welcome, {userName}!
            </span>
          )}
        </div>
        <nav className="flex items-center gap-2 sm:gap-4">
          {user && (
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-0 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
