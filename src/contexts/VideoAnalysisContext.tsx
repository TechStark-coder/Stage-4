
"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback } from "react";
import type { DescribeRoomObjectsOutput } from "@/ai/flows/describe-room-objects-from-video";

interface RoomAnalysisState {
  videoFile: File | null;
  analysisResult: DescribeRoomObjectsOutput | null;
}

interface VideoAnalysisContextType {
  getRoomState: (roomId: string) => RoomAnalysisState | undefined;
  setRoomState: (roomId: string, state: Partial<RoomAnalysisState>) => void;
  clearRoomState: (roomId: string) => void;
}

const VideoAnalysisContext = createContext<VideoAnalysisContextType | undefined>(undefined);

export function VideoAnalysisProvider({ children }: { children: ReactNode }) {
  const [analysisData, setAnalysisData] = useState<Record<string, RoomAnalysisState>>({});

  const getRoomState = useCallback((roomId: string) => {
    return analysisData[roomId];
  }, [analysisData]);

  const setRoomState = useCallback((roomId: string, state: Partial<RoomAnalysisState>) => {
    setAnalysisData(prev => ({
      ...prev,
      [roomId]: {
        ...(prev[roomId] || { videoFile: null, analysisResult: null }),
        ...state,
      },
    }));
  }, []);
  
  const clearRoomState = useCallback((roomId: string) => {
    setAnalysisData(prev => {
        const newState = {...prev};
        delete newState[roomId];
        return newState;
    })
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
