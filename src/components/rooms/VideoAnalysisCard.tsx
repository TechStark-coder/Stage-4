
"use client";

import * as _React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, ListTree, Sparkles, Download, Trash2, Loader2, Video } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";
import type { DescribeRoomObjectsOutput } from "@/ai/flows/describe-room-objects";
import { ForestLoader } from "./ForestLoader"; // Import the new loader
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';


interface VideoAnalysisCardProps {
  analysisResult: DescribeRoomObjectsOutput | null;
  isAnalyzing: boolean;
  onClearResults: () => void; 
  title: string;
  lastAnalyzedAt?: Timestamp | null;
}

export function VideoAnalysisCard({ analysisResult, isAnalyzing, onClearResults, title, lastAnalyzedAt }: VideoAnalysisCardProps) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = _React.useState(false);

  const handleDownloadPdf = async () => {
    if (!analysisResult || !analysisResult.objects || analysisResult.objects.length === 0) {
        toast({
            title: "No Analysis Data",
            description: "There are no analyzed objects to download.",
            variant: "default",
        });
        return;
    }
    setIsDownloading(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(title, 14, 22);
      
      doc.setFontSize(12);
      doc.text(`Analyzed on: ${lastAnalyzedAt ? format(lastAnalyzedAt.toDate(), "PPP 'at' p") : new Date().toLocaleDateString()}`, 14, 30);

      doc.setFontSize(14);
      doc.text("Identified Objects:", 14, 45);
      
      let yPos = 55;
      doc.setFontSize(10);
      analysisResult.objects.forEach((item, index) => {
        if (yPos > 270) { 
          doc.addPage();
          yPos = 20;
          doc.setFontSize(18);
          doc.text(`${title} (cont.)`, 14, yPos);
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

      const fileName = `${title.replace(/ /g, "_")}_analysis.pdf`;
      doc.save(fileName);
      toast({ title: "Download Started", description: `Downloading ${fileName}` });
    } catch (error) {
        console.error("Failed to generate PDF:", error);
        toast({title: "PDF Generation Failed", description: "Could not generate the PDF.", variant: "destructive"})
    } finally {
        setIsDownloading(false);
    }
  };

  const hasResults = analysisResult && analysisResult.objects && analysisResult.objects.length > 0;

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-6 w-6 text-primary" /> AI Analysis Results
        </CardTitle>
        {lastAnalyzedAt && !isAnalyzing ? (
           <CardDescription className="flex items-center gap-1 text-xs pt-1">
            <Sparkles className="h-3 w-3" />
            Last analyzed on {format(lastAnalyzedAt.toDate(), "PPP 'at' p")}
          </CardDescription>
        ) : (
          <CardDescription>
            Objects identified from the video will appear here.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-grow">
        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ForestLoader />
            <p className="font-semibold text-lg text-foreground -mt-10">AI is analyzing the video...</p>
            <p className="text-sm text-muted-foreground">This may take a few moments. Results will appear here.</p>
          </div>
        ) : hasResults ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Identified Objects:</p>
            <ol className="list-decimal list-inside space-y-1.5 bg-background/50 p-4 rounded-md border max-h-96 overflow-y-auto">
              {analysisResult.objects.map((item, index) => (
                <li key={index} className="text-foreground">
                  {item.name}
                  {item.count > 1 && (
                    <span className="text-muted-foreground/80"> (Count: {item.count})</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ) : ( 
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Awaiting Video Analysis</p>
            <p className="text-sm">Upload a video and click "Analyze Video" to see results.</p>
          </div>
        )}
      </CardContent>
      {hasResults && !isAnalyzing && (
        <CardFooter className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloading}>
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isDownloading ? "Downloading..." : "Download PDF"}
            </Button>
          <Button variant="destructive-outline" onClick={onClearResults}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Results
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
