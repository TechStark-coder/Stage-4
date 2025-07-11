
"use client";

import * as React from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ImageLightboxProps {
  images: string[];
  currentIndex: number | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  isVideos?: boolean;
}

export function ImageLightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
  isVideos = false,
}: ImageLightboxProps) {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen || currentIndex === null) return;
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft") {
        if (images.length > 1 && currentIndex > 0) {
          onNavigate(currentIndex - 1);
        }
      } else if (event.key === "ArrowRight") {
        if (images.length > 1 && currentIndex < images.length - 1) {
          onNavigate(currentIndex + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, currentIndex, images, onClose, onNavigate]);

  React.useEffect(() => {
    if (images[currentIndex ?? -1]) {
      setLoading(true);
    }
  }, [images, currentIndex]);

  if (!isOpen || currentIndex === null || !images[currentIndex]) {
    return null;
  }

  const currentSrc = images[currentIndex];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="p-0 m-0 max-w-[90vw] max-h-[90vh] w-auto h-auto bg-transparent border-none shadow-none flex items-center justify-center overflow-hidden"
        onInteractOutside={onClose}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Enlarged Media Viewer</DialogTitle>
        </DialogHeader>
        <div className="relative w-full h-full flex items-center justify-center">
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Skeleton className="w-[85vw] h-[85vh] max-w-[1200px] max-h-[800px] rounded-md" />
              </div>
            )}
            
            {isVideos ? (
              <video
                src={currentSrc}
                controls
                autoPlay
                className={cn(
                  "object-contain max-w-[85vw] max-h-[85vh] rounded-md shadow-2xl transition-opacity duration-300",
                  loading ? "opacity-0" : "opacity-100"
                )}
                onLoadedData={() => setLoading(false)}
                onCanPlay={() => setLoading(false)}
              />
            ) : (
              <Image
                src={currentSrc}
                alt={`Lightbox image ${currentIndex + 1} of ${images.length}`}
                width={1200}
                height={800}
                className={cn(
                    "object-contain max-w-[85vw] max-h-[85vh] rounded-md shadow-2xl transition-opacity duration-300",
                    loading ? "opacity-0" : "opacity-100"
                )}
                onLoadingComplete={() => setLoading(false)}
                priority
                data-ai-hint="gallery enlarged photo"
              />
            )}
          </div>

          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
                disabled={currentIndex === 0}
                className={cn(
                  "absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white bg-black/30 hover:bg-black/60 rounded-full z-50",
                  currentIndex === 0 && "opacity-50 cursor-not-allowed"
                )}
                aria-label="Previous image"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
                disabled={currentIndex === images.length - 1}
                className={cn(
                  "absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white bg-black/30 hover:bg-black/60 rounded-full z-50",
                  currentIndex === images.length - 1 && "opacity-50 cursor-not-allowed"
                )}
                aria-label="Next image"
              >
                <ArrowRight className="h-6 w-6" />
              </Button>
            </>
          )}
          
          {images.length > 1 && (
            <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-md z-50">
              {currentIndex + 1} / {images.length}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
