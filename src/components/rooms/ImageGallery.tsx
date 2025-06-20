
"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { XCircle, ImageIcon, ImageOff as ImageOffIcon, Trash2 } from "lucide-react"; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ImageGalleryProps {
  pendingPhotos: File[];
  analyzedPhotoUrls: string[];
  onRemovePendingPhoto: (index: number) => void;
  onRemoveAnalyzedPhoto?: (photoUrl: string) => void; // Optional prop
}

export function ImageGallery({ 
  pendingPhotos, 
  analyzedPhotoUrls, 
  onRemovePendingPhoto, 
  onRemoveAnalyzedPhoto 
}: ImageGalleryProps) {
  const hasPendingPhotos = pendingPhotos && pendingPhotos.length > 0;
  const hasAnalyzedPhotos = analyzedPhotoUrls && analyzedPhotoUrls.length > 0;

  if (!hasPendingPhotos && !hasAnalyzedPhotos) {
    return (
      <Card className="shadow-lg border-dashed border-muted-foreground/30 bg-card/80 h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-6 w-6" /> Image Previews
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <p className="text-center text-muted-foreground py-8">
            No photos added for analysis yet. Click "Add Photos" to begin.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-6 w-6 text-primary" /> 
          {hasPendingPhotos ? `Selected Photos (${pendingPhotos.length})` : `Analyzed Photos (${analyzedPhotoUrls.length})`}
        </CardTitle>
        <CardDescription>
          {hasPendingPhotos 
            ? "Images queued for analysis. Click 'X' to remove an image before analysis." 
            : "These images were used for the last successful analysis. Click 'X' to delete an analyzed image."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {hasPendingPhotos ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pendingPhotos.map((file, index) => (
              <div key={`pending-${index}-${file.name}`} className="relative group aspect-square rounded-md overflow-hidden border border-border shadow-sm">
                <Image
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${file.name}`}
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint="room interior"
                  onLoad={(e) => { /* Consider revoking ObjectURL in a cleanup if many images are handled */ }}
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
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {analyzedPhotoUrls.map((url, index) => (
              <div key={`analyzed-${index}-${url}`} className="relative group aspect-square rounded-md overflow-hidden border border-border shadow-sm">
                <Image
                  src={url}
                  alt={`Analyzed image ${index + 1}`}
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint="analyzed room"
                />
                {onRemoveAnalyzedPhoto && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-destructive/80"
                    onClick={() => onRemoveAnalyzedPhoto(url)}
                    aria-label="Delete analyzed image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-8 text-muted-foreground h-full">
            <ImageOffIcon className="h-12 w-12 mb-4 opacity-50" />
             <p className="font-medium">No images to display.</p>
             <p className="text-sm">Add photos or check analysis results.</p>
           </div>
        )}
      </CardContent>
    </Card>
  );
}
