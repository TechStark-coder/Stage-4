
"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { XCircle, ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ImageGalleryProps {
  photos: File[];
  onRemovePhoto: (index: number) => void;
}

export function ImageGallery({ photos, onRemovePhoto }: ImageGalleryProps) {
  if (photos.length === 0) {
    return (
      <Card className="shadow-lg border-dashed border-muted-foreground/30 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-6 w-6" /> Image Previews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No photos added yet. Click "Add Photos" to begin.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-6 w-6 text-primary" /> Added Photos ({photos.length})
        </CardTitle>
        <CardDescription>
          Images queued for analysis. Click the 'X' to remove an image.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {photos.map((file, index) => (
            <div key={index} className="relative group aspect-square rounded-md overflow-hidden border border-border shadow-sm">
              <Image
                src={URL.createObjectURL(file)}
                alt={`Preview ${index + 1}`}
                layout="fill"
                objectFit="cover"
                onLoad={(e) => {
                  // Clean up object URL after image is loaded to prevent memory leaks,
                  // but ensure it's not revoked too early if Image component re-renders.
                  // For robust cleanup, manage these URLs in a state or effect in parent.
                  // URL.revokeObjectURL((e.target as HTMLImageElement).src); // Potential issue if removed then re-added quickly
                }}
                data-ai-hint="room interior"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-destructive/80"
                onClick={() => onRemovePhoto(index)}
                aria-label="Remove image"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
