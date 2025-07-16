
"use client";

import { Button } from "@/components/ui/button";
import { ImageIcon, Trash2, Eye, PlayCircle, X } from "lucide-react"; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImageGalleryProps {
  pendingFiles?: File[];
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
  analyzedPhotoUrls = [],
  analyzedVideoUrls = [],
  onRemovePendingMedia, 
  onRemoveAnalyzedMedia,
  onMediaClick,
  onClearPendingMedia,
  onClearAnalyzedMedia,
}: ImageGalleryProps) {
  const hasPendingFiles = pendingFiles.length > 0;
  const allAnalyzedMedia = [...analyzedPhotoUrls, ...analyzedVideoUrls];
  const hasAnalyzedMedia = allAnalyzedMedia.length > 0;

  if (!hasPendingFiles && !hasAnalyzedMedia) {
    return null;
  }
  
  const getFileNameFromUrl = (url: string): string => {
    try {
      const decodedUrl = decodeURIComponent(url);
      const pathSegment = decodedUrl.split('?')[0];
      const segments = pathSegment.split('/');
      const fileNameWithTimestamp = segments.pop() || 'mediafile';
      // Remove timestamp like '1721016467319-'
      return fileNameWithTimestamp.replace(/^\d{13}-/, '');
    } catch (e) {
      console.error("Could not parse filename from URL:", url, e);
      return "mediafile";
    }
  };

  const renderMediaList = (files: (File | string)[], isPending: boolean) => {
    return (
      <ul className="space-y-2">
        {files.map((media, index) => {
          const isFile = media instanceof File;
          const url = isFile ? "" : media;
          const name = isFile ? media.name : getFileNameFromUrl(media);
          const isVideo = (isFile && media.type.startsWith('video/')) || url.includes('.mov') || url.includes('.mp4') || (isFile && media.name.toLowerCase().endsWith('.mov'));

          const key = isFile ? `pending-${index}-${name}` : `analyzed-${index}-${url}`;

          const fullMediaList = isPending
            ? pendingFiles.map(f => URL.createObjectURL(f))
            : allAnalyzedMedia;
          
          const mediaIndex = isPending ? index : allAnalyzedMedia.findIndex(itemUrl => itemUrl === url);


          return (
            <li key={key} className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3 truncate">
                {isVideo ? <PlayCircle className="h-5 w-5 shrink-0 text-primary" /> : <ImageIcon className="h-5 w-5 shrink-0 text-primary" />}
                <span className="truncate text-sm font-medium">{name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   className="h-8 w-8" 
                   onClick={() => onMediaClick(fullMediaList, mediaIndex, isVideo)}
                   aria-label={`View ${name}`}
                 >
                   <Eye className="h-4 w-4" />
                 </Button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-6 w-6 text-primary" /> 
          Media Gallery
        </CardTitle>
        <CardDescription>
          Review your uploaded media.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-6 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-6">
            {hasPendingFiles && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Pending Media for Analysis ({pendingFiles.length})
                  </h3>
                  <Button variant="outline" size="sm" onClick={onClearPendingMedia}>
                    <X className="mr-2 h-4 w-4" />
                    Clear Pending
                  </Button>
                </div>
                {renderMediaList(pendingFiles, true)}
              </div>
            )}

            {(hasPendingFiles && hasAnalyzedMedia) && <Separator />}

            {hasAnalyzedMedia && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Analyzed Media ({allAnalyzedMedia.length})
                  </h3>
                  <Button variant="destructive-outline" size="sm" onClick={onClearAnalyzedMedia}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear Analyzed
                  </Button>
                </div>
                {renderMediaList(allAnalyzedMedia, false)}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
