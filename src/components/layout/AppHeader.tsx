
"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { auth } from "@/config/firebase";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuthContext } from "@/hooks/useAuthContext";
import { useLoader } from "@/contexts/LoaderContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function AppHeader() {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuthContext();
  const { showLoader, hideLoader } = useLoader();

  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/arc-stay.firebasestorage.app/o/Homiestan.png?alt=media";

  const handleLogout = async () => {
    showLoader();
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push("/login");
      // AppRouterEvents on /login page will handle hiding the loader
    } catch (error: any) {
      toast({ title: "Logout Failed", description: error.message, variant: "destructive" });
      hideLoader(); // Hide loader only if logout fails
    }
  };

  const userName = user?.displayName || (user?.email ? user.email.split('@')[0] : "User");

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center px-4 md:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 mr-auto">
          <Image
            src={logoUrl}
            alt="HomieStan"
            width={150}
            height={38} // Approximate height based on 4:1 aspect ratio of 980x245
            className="object-contain" // Ensures aspect ratio is maintained
            unoptimized // if using external URLs not in next.config.js images.domains
          />
        </Link>
        <div className="flex-grow text-center">
          {user && (
            <span className="text-sm font-medium text-foreground sm:text-base welcome-text-shine">
              Welcome, {userName}!
            </span>
          )}
        </div>
        <nav className="flex items-center gap-2 sm:gap-4 ml-auto">
          {user && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <LogOut className="mr-0 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to log out?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    Yes, logout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </nav>
      </div>
    </header>
  );
}
