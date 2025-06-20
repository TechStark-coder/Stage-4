
"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { XCircle, ImageIcon, ImageOff as ImageOffIcon, Trash2, Eye } from "lucide-react"; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ImageGalleryProps {
  pendingPhotos: File[];
  analyzedPhotoUrls: string[];
  onRemovePendingPhoto: (index: number) => void;
  onRemoveAnalyzedPhoto?: (photoUrl: string) => void;
  onImageClick: (imageUrls: string[], startIndex: number, isPending: boolean) => void; 
}

export function ImageGallery({ 
  pendingPhotos, 
  analyzedPhotoUrls, 
  onRemovePendingPhoto, 
  onRemoveAnalyzedPhoto,
  onImageClick 
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

  const handlePendingImageClick = (index: number) => {
    const urls = pendingPhotos.map(file => URL.createObjectURL(file));
    onImageClick(urls, index, true); 
  };

  const handleAnalyzedImageClick = (index: number) => {
    onImageClick(analyzedPhotoUrls, index, false);
  };

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-6 w-6 text-primary" /> 
          {hasPendingPhotos ? `Selected Photos (${pendingPhotos.length})` : `Analyzed Photos (${analyzedPhotoUrls.length})`}
        </CardTitle>
        <CardDescription>
          {hasPendingPhotos 
            ? "Images queued for analysis. Click 'X' to remove, or image to enlarge." 
            : "Analyzed images. Click 'X' to delete, or image to enlarge."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {hasPendingPhotos ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pendingPhotos.map((file, index) => (
              <div 
                key={`pending-${index}-${file.name}`} 
                className="relative group aspect-square rounded-md overflow-hidden border border-border shadow-sm cursor-pointer"
                onClick={() => handlePendingImageClick(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePendingImageClick(index);}}
              >
                <Image
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${file.name}`}
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint="room interior"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye className="h-8 w-8 text-white" />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-destructive/80 z-10"
                  onClick={(e) => { e.stopPropagation(); onRemovePendingPhoto(index); }}
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
              <div 
                key={`analyzed-${index}-${url}`} 
                className="relative group aspect-square rounded-md overflow-hidden border border-border shadow-sm cursor-pointer"
                onClick={() => handleAnalyzedImageClick(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAnalyzedImageClick(index);}}
              >
                <Image
                  src={url}
                  alt={`Analyzed image ${index + 1}`}
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint="analyzed room"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye className="h-8 w-8 text-white" />
                </div>
                {onRemoveAnalyzedPhoto && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-destructive/80 z-10"
                    onClick={(e) => { e.stopPropagation(); onRemoveAnalyzedPhoto(url); }}
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
