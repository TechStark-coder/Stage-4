
"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Home } from "@/types";
import { ArrowRight, CalendarDays, Home as HomeIcon, ImageOff, Trash2 } from "lucide-react"; // Removed Edit, already in EditHomeDialog
import { format } from "date-fns";
import Image from "next/image";
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

interface HomeCardProps {
  home: Home;
  onHomeAction: () => void; // Renamed from onHomeDeleted for broader use (update/delete)
}

export function HomeCard({ home, onHomeAction }: HomeCardProps) {
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoader();
  // No need for local coverImageSrc state, home.coverImageUrl is direct from Firestore

  const handleDelete = async () => {
    showLoader();
    try {
      await deleteHome(home.id); 
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
    <Card className="flex flex-col transition-all duration-300 ease-out hover:scale-105 hover:z-20 hover:shadow-2xl hover:shadow-primary/30 dark:hover:shadow-primary/50">
      <CardHeader className="pb-2">
        {home.coverImageUrl ? (
          <div className="relative w-full h-40 mb-4 rounded-t-lg overflow-hidden">
            <Image
              src={home.coverImageUrl}
              alt={`${home.name} cover image`}
              layout="fill"
              objectFit="cover"
              priority // Consider adding priority for LCP images if these are above the fold
              data-ai-hint="house exterior"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-40 mb-4 bg-muted rounded-t-lg">
            <ImageOff className="h-16 w-16 text-muted-foreground/50" />
          </div>
        )}
        <CardTitle className="flex items-center gap-2">
          <HomeIcon className="h-6 w-6 text-primary" />
          {home.name}
        </CardTitle>
        {home.createdAt && (
          <CardDescription className="flex items-center gap-1 text-xs">
            <CalendarDays className="h-3 w-3" />
            Created on {format(home.createdAt.toDate(), "PPP")}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-grow pt-2">
        <p className="text-sm text-muted-foreground">
          Manage rooms and analyze objects within this home.
        </p>
      </CardContent>
      <CardFooter className="flex justify-between items-center gap-2 pt-4">
        <div className="flex gap-2">
           <EditHomeDialog home={home} onHomeUpdated={onHomeAction} />
           <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive-outline" size="sm" className="text-destructive hover:bg-destructive/10 border-destructive/50 hover:border-destructive">
                <Trash2 className="h-4 w-4" />
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
        <Button asChild variant="default" size="sm">
          <Link href={`/homes/${home.id}`}>
            View Rooms <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
