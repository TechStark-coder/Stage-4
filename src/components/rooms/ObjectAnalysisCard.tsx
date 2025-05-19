
"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { Room } from "@/types";
import { Eye, ListTree, Sparkles, Download, Trash2 } from "lucide-react"; 
import { format } from "date-fns";
import { Button } from "@/components/ui/button"; // Kept for "Clear Results"
import jsPDF from "jspdf";
import { useLoader } from "@/contexts/LoaderContext"; // General loader for clear results
import { useToast } from "@/hooks/use-toast";

interface ObjectAnalysisCardProps {
  room: Room | null;
  onClearResults: () => Promise<void>; 
  homeName?: string;
  // showSpinner prop removed as AI spinner is now global
}

export function ObjectAnalysisCard({ room, onClearResults, homeName }: ObjectAnalysisCardProps) {
  const { showLoader: showGlobalLoader, hideLoader: hideGlobalLoader } = useLoader(); 
  const { toast } = useToast();

  const handleDownloadPdf = () => {
    if (!room || !room.objectNames || !room.name) return;
    showGlobalLoader(); // Show general loader for PDF generation
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
      room.objectNames.forEach((name, index) => {
        if (yPos > 270) { 
          doc.addPage();
          yPos = 20;
        }
        doc.text(`${index + 1}. ${name}`, 14, yPos);
        yPos += 10;
      });

      const fileName = `${(homeName ? homeName.replace(/ /g, "_") + "_" : "") + room.name.replace(/ /g, "_")}_analysis.pdf`;
      doc.save(fileName);
      toast({ title: "Download Started", description: `Downloading ${fileName}` });
    } catch (error) {
        console.error("Failed to generate PDF:", error);
        toast({title: "PDF Generation Failed", description: "Could not generate the PDF.", variant: "destructive"})
    } finally {
        hideGlobalLoader(); // Hide general loader
    }
  };

  const handleClear = async () => {
    showGlobalLoader(); // Show general loader for clearing results
    try {
      await onClearResults();
    } catch (error) {
      console.error("Error in handleClear (ObjectAnalysisCard):", error);
      // Toast for error is likely handled in onClearResults or page level
    } finally {
      hideGlobalLoader(); // Hide general loader
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
  
  // The AI analysis spinner is now handled globally by AiAnalysisLoaderContext
  // This card will just show a textual indication if analysis is in progress from DB
  // or focus on showing results.

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
        {room.isAnalyzing && ( // Textual fallback if user reloads during analysis
          <CardDescription className="flex items-center gap-1 text-xs pt-1 text-accent-foreground">
            <Sparkles className="h-3 w-3 animate-pulse" />
            Analysis is currently in progress...
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {room?.objectNames && room.objectNames.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Identified Objects:</p>
            <ul className="list-disc list-inside space-y-1 bg-background/50 p-4 rounded-md border max-h-60 overflow-y-auto">
              {room.objectNames.map((name, index) => (
                <li key={index} className="text-foreground">{name}</li>
              ))}
            </ul>
          </div>
        ) : !room.isAnalyzing ? ( // Show "No objects" only if not actively analyzing (as per DB)
          <div className="text-center py-8 text-muted-foreground">
            <ListTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No objects described yet.</p>
            <p className="text-sm">Upload photos and click "Analyze Images" to see results here.</p>
          </div>
        ) : null /* Don't show "No objects" if isAnalyzing is true from DB, global spinner handles this visually */ }
      </CardContent>
      {(room?.objectNames && room.objectNames.length > 0 && !room.isAnalyzing) && (
        <CardFooter className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4">
          <a 
            onClick={handleDownloadPdf} 
            className="codepen-button" 
            style={{ width: 'fit-content', textDecoration: 'none' }}
            role="button" // For accessibility
            tabIndex={0} // For keyboard accessibility
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDownloadPdf();}} // For keyboard accessibility
          >
            <span className="flex items-center"> {/* Ensure span content is also flex for alignment */}
              <Download className="mr-2 h-4 w-4" /> {/* Icon inside span */}
              Download PDF
            </span>
          </a>
          <Button variant="destructive-outline" onClick={handleClear}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear Results
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
