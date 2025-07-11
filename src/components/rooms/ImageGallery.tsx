
"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { XCircle, ImageIcon, ImageOff as ImageOffIcon, Trash2, Eye, PlayCircle } from "lucide-react"; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ImageGalleryProps {
  pendingPhotos?: File[];
  analyzedPhotoUrls: string[];
  onRemovePendingPhoto?: (index: number) => void;
  onRemoveAnalyzedPhoto?: (photoUrl: string) => void;
  onImageClick: (urlsOrFiles: string[] | File[], startIndex: number, isPending?: boolean) => void; 
  galleryTitle?: string;
  emptyStateMessage?: string;
  isVideos?: boolean;
}

export function ImageGallery({ 
  pendingPhotos = [],
  analyzedPhotoUrls, 
  onRemovePendingPhoto, 
  onRemoveAnalyzedPhoto,
  onImageClick,
  galleryTitle = "Image Gallery",
  emptyStateMessage = 'No photos added for analysis yet. Click "Add Photos" to begin.',
  isVideos = false,
}: ImageGalleryProps) {
  const hasPendingPhotos = pendingPhotos.length > 0;
  const hasAnalyzedPhotos = analyzedPhotoUrls.length > 0;
  const GalleryIcon = isVideos ? PlayCircle : ImageIcon;

  if (!hasPendingPhotos && !hasAnalyzedPhotos) {
    return (
      <Card className="shadow-lg border-dashed border-muted-foreground/30 bg-card/80 h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <GalleryIcon className="h-6 w-6" /> {galleryTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <p className="text-center text-muted-foreground py-8">
            {emptyStateMessage}
          </p>
        </CardContent>
      </Card>
    );
  }

  const handlePendingImageClick = (index: number) => {
    onImageClick(pendingPhotos, index, true); 
  };

  const handleAnalyzedImageClick = (index: number) => {
    onImageClick(analyzedPhotoUrls, index, false);
  };

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GalleryIcon className="h-6 w-6 text-primary" /> 
          {galleryTitle}
        </CardTitle>
        <CardDescription>
          Review current media. Click to view.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-6">
        {hasAnalyzedPhotos && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Analyzed Media ({analyzedPhotoUrls.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {analyzedPhotoUrls.map((url, index) => (
                <div 
                  key={`analyzed-${index}-${url}`} 
                  className="relative group aspect-square rounded-md overflow-hidden border border-border shadow-sm cursor-pointer bg-black"
                  onClick={() => handleAnalyzedImageClick(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAnalyzedImageClick(index);}}
                >
                  {isVideos ? (
                    <video src={url} className="w-full h-full object-cover" preload="metadata" />
                  ) : (
                    <Image
                      src={url}
                      alt={`Analyzed media ${index + 1}`}
                      layout="fill"
                      objectFit="cover"
                      data-ai-hint="analyzed room"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye className="h-8 w-8 text-white" />
                  </div>
                  {onRemoveAnalyzedPhoto && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-destructive/80 z-10"
                      onClick={(e) => { e.stopPropagation(); onRemoveAnalyzedPhoto(url); }}
                      aria-label="Delete analyzed media"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {hasPendingPhotos && hasAnalyzedPhotos && <Separator />}

        {hasPendingPhotos && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              New Media for Analysis ({pendingPhotos.length})
            </h3>
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
                    onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye className="h-8 w-8 text-white" />
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-destructive/80 z-10"
                    onClick={(e) => { e.stopPropagation(); onRemovePendingPhoto?.(index); }}
                    aria-label="Remove image"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
