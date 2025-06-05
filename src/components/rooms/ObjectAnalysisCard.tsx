
"use client";

import * as _React from 'react'; // Keep React for useState
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { Room } from "@/types";
import { Eye, ListTree, Sparkles, Download, Trash2, Loader2 } from "lucide-react"; 
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";

interface ObjectAnalysisCardProps {
  room: Room | null;
  onClearResults: () => Promise<void>; 
  homeName?: string;
}

export function ObjectAnalysisCard({ room, onClearResults, homeName }: ObjectAnalysisCardProps) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = _React.useState(false);
  const [isClearing, setIsClearing] = _React.useState(false);

  const handleDownloadPdf = async () => {
    if (isDownloading || !room || !room.analyzedObjects || room.analyzedObjects.length === 0 || !room.name) {
        toast({
            title: "No Analysis Data",
            description: "This room has no analyzed objects to download.",
            variant: "default",
        });
        return;
    }
    setIsDownloading(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(`Object Analysis for: ${homeName ? homeName + " - " : ""}${room.name}`, 14, 22);
      
      doc.setFontSize(12);
      if (room.lastAnalyzedAt) {
        doc.text(`Analyzed on: ${format(room.lastAnalyzedAt.toDate(), "PPP 'at' p")}`, 14, 30);
      }

      doc.setFontSize(14);
      doc.text("Identified Objects:", 14, 45);
      
      let yPos = 55;
      doc.setFontSize(10);
      room.analyzedObjects.forEach((item, index) => {
        if (yPos > 270) { 
          doc.addPage();
          yPos = 20;
           doc.setFontSize(18);
          doc.text(`Object Analysis (cont.): ${homeName ? homeName + " - " : ""}${room.name}`, 14, yPos);
          yPos +=15
          doc.setFontSize(14);
          doc.text("Identified Objects (cont.):", 14, yPos);
          yPos +=10
           doc.setFontSize(10);
        }
        const countText = item.count > 1 ? ` (Count: ${item.count})` : "";
        doc.text(`${index + 1}. ${item.name}${countText}`, 14, yPos);
        yPos += 8;
      });

      const fileName = `${(homeName ? homeName.replace(/ /g, "_") + "_" : "") + room.name.replace(/ /g, "_")}_analysis.pdf`;
      doc.save(fileName);
      toast({ title: "Download Started", description: `Downloading ${fileName}` });
    } catch (error) {
        console.error("Failed to generate PDF:", error);
        toast({title: "PDF Generation Failed", description: "Could not generate the PDF.", variant: "destructive"})
    } finally {
        setIsDownloading(false);
    }
  };

  const handleClear = async () => {
    if (isClearing) return;
    setIsClearing(true);
    try {
      await onClearResults();
      // Success toast is likely handled by the onClearResults callback or the page itself
    } catch (error) {
      console.error("Failed to clear results via ObjectAnalysisCard:", error);
      toast({ title: "Error Clearing Results", description: "An unexpected error occurred while clearing results.", variant: "destructive" });
    } finally {
      setIsClearing(false);
    }
  };

  if (!room) {
    return (
      <Card className="shadow-lg bg-card/80 mt-6">
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
    <Card className="shadow-lg mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-6 w-6 text-primary" /> Object Analysis Results
        </CardTitle>
        {room?.lastAnalyzedAt && !room.isAnalyzing && ( 
           <CardDescription className="flex items-center gap-1 text-xs pt-1">
            <Sparkles className="h-3 w-3" />
            Last analyzed on {format(room.lastAnalyzedAt.toDate(), "PPP 'at' p")}
          </CardDescription>
        )}
        {room.isAnalyzing && ( 
          <CardDescription className="flex items-center gap-1 text-xs pt-1 text-accent-foreground">
            <Sparkles className="h-3 w-3 animate-pulse" />
            Analysis is currently in progress...
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {room?.analyzedObjects && room.analyzedObjects.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Identified Objects:</p>
            <ol className="list-decimal list-inside space-y-1.5 bg-background/50 p-4 rounded-md border max-h-60 overflow-y-auto">
              {room.analyzedObjects.map((item, index) => (
                <li key={index} className="text-foreground">
                  {item.name}
                  {item.count > 1 && (
                    <span className="text-muted-foreground/80"> (Count: {item.count})</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ) : !room.isAnalyzing ? ( 
          <div className="text-center py-8 text-muted-foreground">
            <ListTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No objects described yet.</p>
            <p className="text-sm">Upload photos and click "Analyze Images" to see results here.</p>
          </div>
        ) : null }
      </CardContent>
      {(room?.analyzedObjects && room.analyzedObjects.length > 0 && !room.isAnalyzing) && (
        <CardFooter className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4">
          <a 
            onClick={handleDownloadPdf} 
            className={`codepen-button ${isDownloading ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ width: 'fit-content', textDecoration: 'none' }}
            role="button"
            tabIndex={isDownloading ? -1 : 0}
            onKeyDown={(e) => { if (!isDownloading && (e.key === 'Enter' || e.key === ' ')) handleDownloadPdf();}}
            aria-disabled={isDownloading}
          >
            <span className="flex items-center justify-center"> 
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isDownloading ? "Downloading..." : "Download PDF"}
            </span>
          </a>
          <Button variant="destructive-outline" onClick={handleClear} disabled={isClearing}>
            {isClearing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {isClearing ? "Clearing..." : "Clear Results"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

