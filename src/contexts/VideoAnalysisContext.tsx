
"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { DescribeRoomObjectsOutput } from "@/ai/flows/describe-room-objects-from-video";

// This context is no longer needed for managing video analysis state,
// as the state is now persisted directly in Firestore.
// It is being kept to avoid breaking imports, but its logic is now empty.
// It can be safely removed in a future cleanup pass if all components are updated.

interface RoomAnalysisState {
  videoFiles: File[];
  analysisResult: DescribeRoomObjectsOutput | null;
}

interface VideoAnalysisContextType {
  getRoomState: (roomId: string) => RoomAnalysisState | undefined;
  setRoomState: (roomId: string, state: Partial<RoomAnalysisState>) => void;
  clearRoomState: (roomId: string) => void;
}

const VideoAnalysisContext = createContext<VideoAnalysisContextType | undefined>(undefined);

export function VideoAnalysisProvider({ children }: { children: ReactNode }) {
  
  const getRoomState = useCallback((roomId: string) => {
    // No-op, returns undefined
    return undefined;
  }, []);

  const setRoomState = useCallback((roomId: string, state: Partial<RoomAnalysisState>) => {
    // No-op
  }, []);
  
  const clearRoomState = useCallback((roomId: string) => {
    // No-op
  }, []);

  return (
    <VideoAnalysisContext.Provider value={{ getRoomState, setRoomState, clearRoomState }}>
      {children}
    </VideoAnalysisContext.Provider>
  );
}

export function useVideoAnalysis(): VideoAnalysisContextType {
  const context = useContext(VideoAnalysisContext);
  if (context === undefined) {
    throw new Error("useVideoAnalysis must be used within a VideoAnalysisProvider");
  }
  return context;
}
