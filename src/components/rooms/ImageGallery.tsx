
"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { XCircle, ImageIcon, Trash2, Eye, PlayCircle, X } from "lucide-react"; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ImageGalleryProps {
  pendingFiles: File[];
  analyzedPhotoUrls: string[];
  analyzedVideoUrls: string[];
  onRemovePendingMedia: (index: number) => void;
  onRemoveAnalyzedMedia: (mediaUrl: string) => void;
  onMediaClick: (urls: string[], startIndex: number, isVideo?: boolean) => void;
  onClearPendingMedia: () => void;
  onClearAnalyzedMedia: () => void;
}

export function ImageGallery({ 
  pendingFiles = [],
  analyzedPhotoUrls, 
  analyzedVideoUrls,
  onRemovePendingMedia, 
  onRemoveAnalyzedMedia,
  onMediaClick,
  onClearPendingMedia,
  onClearAnalyzedMedia,
}: ImageGalleryProps) {
  const hasPendingFiles = pendingFiles.length > 0;
  const hasAnalyzedPhotos = analyzedPhotoUrls.length > 0;
  const hasAnalyzedVideos = analyzedVideoUrls.length > 0;
  const hasAnalyzedMedia = hasAnalyzedPhotos || hasAnalyzedVideos;

  if (!hasPendingFiles && !hasAnalyzedMedia) {
    return null; // Don't render anything if there's no media at all
  }

  const handlePendingMediaClick = (index: number) => {
    const urls = pendingFiles.map(file => URL.createObjectURL(file));
    const isVideo = pendingFiles[index].type.startsWith('video/');
    onMediaClick(urls, index, isVideo);
    // URLs are revoked via onLoad in the Image component or handled by the lightbox
  };

  const handleAnalyzedPhotoClick = (index: number) => {
    onMediaClick(analyzedPhotoUrls, index, false);
  };

  const handleAnalyzedVideoClick = (index: number) => {
    onMediaClick(analyzedVideoUrls, index, true);
  };
  
  const renderMediaGrid = (files: (File | string)[], isPending: boolean) => {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {files.map((media, index) => {
          const isFile = media instanceof File;
          const url = isFile ? URL.createObjectURL(media) : media;
          const isVideo = isFile ? media.type.startsWith('video/') : (url.includes('.mov') || url.includes('.mp4') || url.includes('.webm'));
          const key = isFile ? `pending-${index}-${media.name}` : `analyzed-${index}-${url}`;

          return (
            <div 
              key={key} 
              className="relative group aspect-square rounded-md overflow-hidden border border-border shadow-sm cursor-pointer bg-black"
              onClick={() => {
                if(isPending) handlePendingMediaClick(index);
                else if(isVideo) handleAnalyzedVideoClick(analyzedVideoUrls.indexOf(url));
                else handleAnalyzedPhotoClick(analyzedPhotoUrls.indexOf(url));
              }}
              role="button"
              tabIndex={0}
            >
              {isVideo ? (
                <video src={url} className="w-full h-full object-cover" preload="metadata" />
              ) : (
                <Image
                  src={url}
                  alt={`Media ${index + 1}`}
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint="analyzed room"
                  onLoad={isFile ? (e) => URL.revokeObjectURL((e.target as HTMLImageElement).src) : undefined}
                />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {isVideo ? <PlayCircle className="h-10 w-10 text-white" /> : <Eye className="h-8 w-8 text-white" />}
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-destructive/80 z-10"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (isPending) {
                    onRemovePendingMedia(index);
                  } else {
                    onRemoveAnalyzedMedia(url);
                  }
                }}
                aria-label={`Remove ${isVideo ? 'video' : 'photo'}`}
              >
                {isPending ? <XCircle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        })}
      </div>
    )
  }


  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader className="flex flex-row justify-between items-start">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-primary" /> 
            Media Gallery
          </CardTitle>
          <CardDescription>
            Review current and analyzed media. Click to view.
          </CardDescription>
        </div>
        
      </CardHeader>
      <CardContent className="flex-grow space-y-6">
        {hasPendingFiles && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Pending Media for Analysis ({pendingFiles.length})
              </h3>
              <Button variant="outline" size="sm" onClick={onClearPendingMedia}>
                <X className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            </div>
            {renderMediaGrid(pendingFiles, true)}
          </div>
        )}

        {(hasPendingFiles && hasAnalyzedMedia) && <Separator />}

        {hasAnalyzedMedia && (
          <div>
             <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Analyzed Media ({analyzedPhotoUrls.length + analyzedVideoUrls.length})
              </h3>
              <Button variant="destructive-outline" size="sm" onClick={onClearAnalyzedMedia}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Analyzed Media
              </Button>
             </div>
            {hasAnalyzedPhotos && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground/80 mb-2">Photos</h4>
                {renderMediaGrid(analyzedPhotoUrls, false)}
              </div>
            )}
            {hasAnalyzedVideos && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground/80 mb-2">Videos</h4>
                {renderMediaGrid(analyzedVideoUrls, false)}
              </div>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
