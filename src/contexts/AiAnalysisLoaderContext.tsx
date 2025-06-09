
"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback } from "react";

interface AiAnalysisLoaderContextType {
  isAiAnalyzing: boolean;
  showAiLoader: () => void;
  hideAiLoader: () => void;
}

const AiAnalysisLoaderContext = createContext<AiAnalysisLoaderContextType | undefined>(
  undefined
);

export function AiAnalysisLoaderProvider({ children }: { children: ReactNode }) {
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  const showAiLoader = useCallback(() => {
    console.log("AI CONTEXT: showAiLoader called - setting isAiAnalyzing to true");
    setIsAiAnalyzing(true);
  }, []);

  const hideAiLoader = useCallback(() => {
    console.log("AI CONTEXT: hideAiLoader called - setting isAiAnalyzing to false");
    setIsAiAnalyzing(false);
  }, []);

  return (
    <AiAnalysisLoaderContext.Provider
      value={{ isAiAnalyzing, showAiLoader, hideAiLoader }}
    >
      {children}
    </AiAnalysisLoaderContext.Provider>
  );
}

export function useAiAnalysisLoader(): AiAnalysisLoaderContextType {
  const context = useContext(AiAnalysisLoaderContext);
  if (context === undefined) {
    throw new Error(
      "useAiAnalysisLoader must be used within an AiAnalysisLoaderProvider"
    );
  }
  return context;
}
