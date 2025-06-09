
"use client";

import { useAiAnalysisLoader } from "@/contexts/AiAnalysisLoaderContext";

export function GlobalAiAnalysisLoader() {
  const { isAiAnalyzing } = useAiAnalysisLoader();

  if (!isAiAnalyzing) {
    return null;
  }

  return (
    <div className="ai-analysis-loader-overlay">
      <div className="ai-waving-gradient-background"></div>
      <div className="ai-analysis-loader-content">
        <h3>HomieStan AI is Working...</h3>
        <p>Analyzing the details, please wait a moment.</p>
      </div>
    </div>
  );
}
