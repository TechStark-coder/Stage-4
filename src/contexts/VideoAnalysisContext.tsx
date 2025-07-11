
"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { DescribeRoomObjectsOutput } from "@/ai/flows/describe-room-objects-from-video";

interface RoomAnalysisState {
  videoFiles: File[]; // Note: File objects cannot be stored in sessionStorage directly
  analysisResult: DescribeRoomObjectsOutput | null;
}

// We will only store the analysisResult in sessionStorage. Video files need to be re-selected.
interface StoredRoomAnalysisState {
    analysisResult: DescribeRoomObjectsOutput | null;
}

interface VideoAnalysisContextType {
  getRoomState: (roomId: string) => RoomAnalysisState | undefined;
  setRoomState: (roomId: string, state: Partial<RoomAnalysisState>) => void;
  clearRoomState: (roomId: string) => void;
}

const VideoAnalysisContext = createContext<VideoAnalysisContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'homiestan_video_analysis';

export function VideoAnalysisProvider({ children }: { children: ReactNode }) {
  // This state will hold both files (in-memory) and results (from session storage)
  const [analysisData, setAnalysisData] = useState<Record<string, RoomAnalysisState>>({});

  // Load from sessionStorage on initial render
  useEffect(() => {
    try {
      const storedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (storedData) {
        const parsedData: Record<string, StoredRoomAnalysisState> = JSON.parse(storedData);
        // We only restore the analysisResult, not the files.
        const restoredState: Record<string, RoomAnalysisState> = {};
        for (const roomId in parsedData) {
            restoredState[roomId] = {
                videoFiles: [], // Files must be re-added by user
                analysisResult: parsedData[roomId].analysisResult,
            };
        }
        setAnalysisData(restoredState);
      }
    } catch (error) {
      console.error("Could not restore video analysis state from sessionStorage:", error);
    }
  }, []);

  const getRoomState = useCallback((roomId: string) => {
    return analysisData[roomId];
  }, [analysisData]);

  const setRoomState = useCallback((roomId: string, state: Partial<RoomAnalysisState>) => {
    setAnalysisData(prev => {
        const newState = {
            ...prev,
            [roomId]: {
                ...(prev[roomId] || { videoFiles: [], analysisResult: null }),
                ...state,
            },
        };

        // Persist only the analysisResult to sessionStorage
        try {
            const dataToStore: Record<string, StoredRoomAnalysisState> = {};
            for (const rId in newState) {
                if (newState[rId].analysisResult) {
                     dataToStore[rId] = {
                        analysisResult: newState[rId].analysisResult,
                     };
                }
            }
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(dataToStore));
        } catch (error) {
            console.error("Could not save video analysis state to sessionStorage:", error);
        }

        return newState;
    });
  }, []);
  
  const clearRoomState = useCallback((roomId: string) => {
    setAnalysisData(prev => {
        const newState = {...prev};
        delete newState[roomId];
        
        // Also remove from sessionStorage
        try {
            const storedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if(storedData) {
                const parsedData = JSON.parse(storedData);
                delete parsedData[roomId];
                sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsedData));
            }
        } catch (error) {
            console.error("Could not clear video analysis state from sessionStorage:", error);
        }

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
