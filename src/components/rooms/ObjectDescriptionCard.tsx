
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Room } from "@/types";
import { Eye, ListTree, Sparkles } from "lucide-react";
import { format } from "date-fns";

interface ObjectDescriptionCardProps {
  room: Room | null;
}

export function ObjectDescriptionCard({ room }: ObjectDescriptionCardProps) {
  if (!room) {
    return (
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTree className="h-6 w-6 text-muted-foreground" /> Object Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading room data...</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-6 w-6 text-primary" /> Object Analysis Results
        </CardTitle>
        {room.lastAnalyzedAt && (
           <CardDescription className="flex items-center gap-1 text-xs pt-1">
            <Sparkles className="h-3 w-3" />
            Last analyzed on {format(room.lastAnalyzedAt.toDate(), "PPP 'at' p")}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {room.isAnalyzing ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Wand2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-medium">AI is analyzing the room...</p>
              <p className="text-sm">This may take a few moments.</p>
            </div>
          </div>
        ) : room.objectDescription ? (
          <div className="prose prose-sm max-w-none dark:prose-invert text-foreground whitespace-pre-wrap bg-background p-4 rounded-md border">
            {room.objectDescription}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <ListTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No objects described yet.</p>
            <p className="text-sm">Upload photos and click "Analyze Objects" to see results here.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// For Wand2 spin animation
const Wand2 = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L11.28 9.72a1.21 1.21 0 0 0 0 1.72l6.36 6.36a1.21 1.21 0 0 0 1.72 0l6.36-6.36a1.21 1.21 0 0 0 0-1.72Z"/><path d="M14 7.5 12 9.5l-5 5L2.5 19l1.5-6.5Z"/><path d="M6.5 12.5 5 11l-2 6 6-2 1.5-1.5Z"/><path d="M12.5 6.5 11 5l-2 6 6-2 1.5-1.5Z"/></svg>
);

