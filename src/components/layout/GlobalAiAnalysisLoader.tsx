
"use client";

import { useAiAnalysisLoader } from "@/contexts/AiAnalysisLoaderContext";
import { ForestLoader } from "@/components/rooms/ForestLoader";

export function GlobalAiAnalysisLoader() {
  const { isAiAnalyzing } = useAiAnalysisLoader();

  if (!isAiAnalyzing) {
    return null;
  }

  return (
    <div className="ai-loader-overlay">
      <ForestLoader />
      <div className="text-center text-white -mt-10">
        <p className="font-semibold text-lg">AI is analyzing the media...</p>
        <p className="text-sm">This may take a few moments. Results will appear shortly.</p>
      </div>
    </div>
  );
}
