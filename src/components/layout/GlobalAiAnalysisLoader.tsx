
"use client";

import { useAiAnalysisLoader } from "@/contexts/AiAnalysisLoaderContext";

export function GlobalAiAnalysisLoader() {
  const { isAiAnalyzing } = useAiAnalysisLoader();

  // console.log("GLOBAL AI LOADER: isAiAnalyzing state is:", isAiAnalyzing);

  if (!isAiAnalyzing) {
    return null;
  }

  return (
    <div className="ai-loader-overlay"> {/* This class handles the full-screen overlay and centering */}
      <div className="loading"> {/* User's provided top-level class */}
        <div className="loading-wide">
          <div className="l1 color"></div>
          <div className="l2 color"></div>
          <div className="e1 color animation-effect-light"></div>
          <div className="e2 color animation-effect-light-d"></div>
          <div className="e3 animation-effect-rot">X</div>
          <div className="e4 color animation-effect-light"></div>
          <div className="e5 color animation-effect-light-d"></div>
          <div className="e6 animation-effect-scale">*</div>
          <div className="e7 color"></div>
          <div className="e8 color"></div>
        </div>
      </div>
    </div>
  );
}
