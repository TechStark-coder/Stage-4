
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/config/firebase";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Aperture, LogOut, LayoutDashboard } from "lucide-react";
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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-xl font-semibold text-primary">
          <Aperture className="h-7 w-7" />
          <span>HomeLens</span>
        </Link>
        <nav className="flex items-center gap-4">
          {user && (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
