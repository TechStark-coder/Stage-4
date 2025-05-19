
import type { Timestamp } from "firebase/firestore";

export interface FirebaseDocument {
  id: string;
}

export interface Home extends FirebaseDocument {
  name: string;
  ownerId: string;
  createdAt: Timestamp;
  // coverImageUrl?: string; // Removed: No longer storing Firebase Storage URL
}

export interface CreateHomeData {
  name: string;
  // coverImage?: File | null; // This is part of form data, not direct Firestore data
  // coverImageUrl?: string; // Removed
}

export interface UpdateHomeData {
  name?: string;
  // coverImage?: File | null; // For form handling
}


export interface Room extends FirebaseDocument {
  name: string;
  homeId?: string;
  createdAt: Timestamp;
  objectNames: string[] | null;
  isAnalyzing?: boolean;
  lastAnalyzedAt?: Timestamp | null;
}

export interface CreateRoomData {
  name:string;
}

export interface UpdateRoomData {
  name?: string;
}

export interface PhotoUploadData {
  photoDataUris: string[];
}
