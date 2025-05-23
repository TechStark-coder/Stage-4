
"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Home } from "@/types";
import { ArrowRight, CalendarDays, Home as HomeIcon, ImageOff, Trash2 } from "lucide-react";
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
  onHomeAction: () => void; 
}

export function HomeCard({ home, onHomeAction }: HomeCardProps) {
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoader();

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
    <Card className="flex flex-col transition-all duration-300 ease-out hover:shadow-2xl hover:shadow-primary/40 hover:scale-105 rounded-lg overflow-hidden bg-card">
      <CardHeader className="p-0">
        {home.coverImageUrl ? (
          <div className="relative w-full h-52 mb-4 overflow-hidden"> {/* Increased height */}
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
          <div className="flex items-center justify-center w-full h-52 mb-4 bg-muted/50 rounded-t-lg"> {/* Increased height */}
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
      <CardContent className="flex-grow pt-2 p-4">
        {home.description ? (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {home.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No description provided.
          </p>
        )}
      </CardContent>
      <CardFooter className="flex justify-between items-center gap-2 pt-4 p-4 border-t">
        <div className="flex gap-2">
           <EditHomeDialog home={home} onHomeUpdated={onHomeAction} />
           <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive-outline" size="sm">
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
