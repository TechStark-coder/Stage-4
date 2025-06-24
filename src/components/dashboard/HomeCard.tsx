
"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Home } from "@/types";
import { ArrowRight, CalendarDays, Home as HomeIcon, ImageOff, MapPin, Trash2, Link2, History } from "lucide-react";
import { format } from "date-fns";
import Image from "next/image";
import * as React from 'react';
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
import { deleteHome } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { EditHomeDialog } from "./EditHomeDialog";
import { useLoader } from "@/contexts/LoaderContext";
import { useAuthContext } from "@/hooks/useAuthContext";
import { GenerateTenantLinkDialog } from "./GenerateTenantLinkDialog"; // Import the new dialog
import { InspectionHistoryDialog } from "@/components/homes/InspectionHistoryDialog";

interface HomeCardProps {
  home: Home;
  onHomeAction: () => void;
}

export function HomeCard({ home, onHomeAction }: HomeCardProps) {
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoader();
  const { user } = useAuthContext();
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = React.useState(false);

  const handleDelete = async () => {
    if (!user || !user.uid) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to delete a home.",
        variant: "destructive",
      });
      return;
    }
    showLoader();
    try {
      await deleteHome(home.id, user.uid);
      toast({
        title: "Home Deleted",
        description: `Home "${home.name}" and all its data have been deleted.`,
      });
      onHomeAction();
    } catch (error: any) {
      console.error("Error deleting home:", error);
      toast({
        title: "Error Deleting Home",
        description: "Could not delete the home: " + error.message,
        variant: "destructive",
      });
    } finally {
      hideLoader();
    }
  };

  return (
    <>
      <Card className="flex flex-col transition-all duration-300 ease-out hover:shadow-2xl hover:shadow-primary/40 hover:scale-105 rounded-lg overflow-hidden bg-card">
        <CardHeader className="p-0">
          {home.coverImageUrl ? (
            <div className="relative w-full h-52 mb-4 overflow-hidden">
              <Image
                src={home.coverImageUrl}
                alt={`${home.name} cover image`}
                layout="fill"
                objectFit="cover"
                priority
                data-ai-hint="house exterior"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-52 mb-4 bg-muted/50 rounded-t-lg">
              <ImageOff className="h-20 w-20 text-muted-foreground/50" />
            </div>
          )}
          <div className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                  <HomeIcon className="h-6 w-6 text-primary" />
                  {home.name}
              </CardTitle>
              {home.createdAt && (
              <CardDescription className="flex items-center gap-1 text-xs mt-1">
                  <CalendarDays className="h-3 w-3" />
                  Created on {format(home.createdAt.toDate(), "PPP")}
              </CardDescription>
              )}
          </div>
        </CardHeader>
        <CardContent className="flex-grow pt-2 p-4 space-y-2">
          {home.address ? (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="line-clamp-3">{home.address}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No address provided.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-4 p-4 border-t">
          {/* Row 1: Edit button, Generate Link button */}
          <div className="flex w-full gap-2">
            <EditHomeDialog home={home} onHomeUpdated={onHomeAction} />
            {user && home.ownerId === user.uid && (
              <GenerateTenantLinkDialog home={home} currentUserUid={user.uid}>
                <Button variant="outline" size="sm" className="flex-1">
                  <Link2 className="mr-1 h-3 w-3" /> Generate Link
                </Button>
              </GenerateTenantLinkDialog>
            )}
          </div>

          {/* Row 2: Manage Rooms button, Delete button */}
          <div className="flex w-full gap-2">
            <Button asChild variant="default" size="sm" className="flex-1">
              <Link href={`/homes/${home.id}`}>
                Manage Rooms <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="flex-1">
                  <Trash2 /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the home
                    "{home.name}" and all its associated rooms, data, and stored images.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                    Yes, delete home
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          
          {user && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setIsHistoryDialogOpen(true)}>
              <History className="mr-2 h-4 w-4" />
              View Inspection History
            </Button>
          )}
        </CardFooter>
      </Card>
      {user && (
        <InspectionHistoryDialog
          homeId={home.id}
          homeName={home.name}
          homeOwnerName={home.ownerDisplayName || 'N/A'}
          isOpen={isHistoryDialogOpen}
          onOpenChange={setIsHistoryDialogOpen}
          currentUserId={user.uid}
        />
      )}
    </>
  );
}
