
"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { Room } from "@/types";
import { Eye, ListTree, Sparkles, Download, Trash2, Loader2 } from "lucide-react"; // Changed Wand2 to Loader2
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";

interface ObjectAnalysisCardProps {
  room: Room | null;
  onClearResults: () => Promise<void>;
  homeName?: string;
}

export function ObjectAnalysisCard({ room, onClearResults, homeName }: ObjectAnalysisCardProps) {
  const handleDownloadPdf = () => {
    if (!room || !room.objectNames || !room.name) return;

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
      if (yPos > 270) { // Simple page break logic
        doc.addPage();
        yPos = 20;
      }
      doc.text(`${index + 1}. ${name}`, 14, yPos);
      yPos += 10;
    });

    const fileName = `${room.name.replace(/ /g, "_")}_analysis.pdf`;
    doc.save(fileName);
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
        {room.lastAnalyzedAt && (
           <CardDescription className="flex items-center gap-1 text-xs pt-1">
            <Sparkles className="h-3 w-3" />
            Last analyzed on {format(room.lastAnalyzedAt.toDate(), "PPP 'at' p")}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {room.isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="font-semibold text-lg text-foreground">AI is analyzing the room...</p>
            <p className="text-sm text-muted-foreground">This may take a few moments. Results will appear here.</p>
          </div>
        ) : room.objectNames && room.objectNames.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Identified Objects:</p>
            <ul className="list-disc list-inside space-y-1 bg-background/50 p-4 rounded-md border max-h-60 overflow-y-auto">
              {room.objectNames.map((name, index) => (
                <li key={index} className="text-foreground">{name}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <ListTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No objects described yet.</p>
            <p className="text-sm">Upload photos and click "Analyze Images" to see results here.</p>
          </div>
        )}
      </CardContent>
      {(room.objectNames && room.objectNames.length > 0 && !room.isAnalyzing) && (
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleDownloadPdf}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          <Button variant="destructive-outline" onClick={onClearResults}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear Results
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
