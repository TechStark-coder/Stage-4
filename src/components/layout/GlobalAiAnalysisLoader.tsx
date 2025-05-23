
"use client";

import { useAiAnalysisLoader } from "@/contexts/AiAnalysisLoaderContext";

export function GlobalAiAnalysisLoader() {
  const { isAiAnalyzing } = useAiAnalysisLoader();

  if (!isAiAnalyzing) {
    return null;
  }

  return (
    <div className="ai-analysis-loader-overlay">
      <div className="ai-spinner-container">
        {/* Spinner HTML from Uiverse.io by mrhyddenn - CSS in globals.css */}
        <div className="ai-spinner"> {/* Renamed from .spinner to .ai-spinner */}
          <div className="ai-spinner-inner"></div> {/* Renamed from .spinnerin to .ai-spinner-inner */}
        </div>
        <p className="text-lg font-semibold text-foreground animate-pulse">
          HomieStan is analyzing...
        </p>
      </div>
    </div>
  );
}
