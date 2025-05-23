
"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { XCircle, ImageIcon, ImageOff as ImageOffIcon } from "lucide-react"; // Renamed ImageOff to ImageOffIcon to avoid conflict
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ImageGalleryProps {
  pendingPhotos: File[];
  analyzedPhotoUrls: string[];
  onRemovePendingPhoto: (index: number) => void;
}

export function ImageGallery({ pendingPhotos, analyzedPhotoUrls, onRemovePendingPhoto }: ImageGalleryProps) {
  const hasPendingPhotos = pendingPhotos && pendingPhotos.length > 0;
  const hasAnalyzedPhotos = analyzedPhotoUrls && analyzedPhotoUrls.length > 0;

  if (!hasPendingPhotos && !hasAnalyzedPhotos) {
    return (
      <Card className="shadow-lg border-dashed border-muted-foreground/30 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-6 w-6" /> Image Previews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No photos added for analysis yet. Click "Add Photos" to begin.
            If analysis was run, results will appear below.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-6 w-6 text-primary" /> 
          {hasPendingPhotos ? `Selected Photos (${pendingPhotos.length})` : "Previously Analyzed Photos"}
        </CardTitle>
        <CardDescription>
          {hasPendingPhotos 
            ? "Images queued for analysis. Click 'X' to remove an image before analysis." 
            : "These images were used for the last successful analysis."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasPendingPhotos ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {pendingPhotos.map((file, index) => (
              <div key={`pending-${index}-${file.name}`} className="relative group aspect-square rounded-md overflow-hidden border border-border shadow-sm">
                <Image
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${file.name}`}
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint="room interior"
                  onLoad={(e) => { /* URL.revokeObjectURL might be needed in a cleanup effect if many images are added/removed frequently */ }}
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-destructive/80"
                  onClick={() => onRemovePendingPhoto(index)}
                  aria-label="Remove image"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : hasAnalyzedPhotos ? (
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {analyzedPhotoUrls.map((url, index) => (
              <div key={`analyzed-${index}`} className="relative aspect-square rounded-md overflow-hidden border border-border shadow-sm">
                <Image
                  src={url}
                  alt={`Analyzed image ${index + 1}`}
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint="analyzed room"
                />
              </div>
            ))}
          </div>
        ) : (
          // This case should ideally not be reached if the top-level if caught it, but as a fallback:
          <div className="flex flex-col items-center justify-center text-center py-8 text-muted-foreground">
            <ImageOffIcon className="h-12 w-12 mb-4 opacity-50" />
             <p className="font-medium">No images to display.</p>
             <p className="text-sm">Add photos or check analysis results.</p>
           </div>
        )}
      </CardContent>
    </Card>
  );
}
