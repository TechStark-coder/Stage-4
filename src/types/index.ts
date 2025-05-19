
import type { Timestamp } from "firebase/firestore";

export interface FirebaseDocument {
  id: string;
}

export interface Home extends FirebaseDocument {
  name: string;
  ownerId: string;
  createdAt: Timestamp;
}

export interface CreateHomeData {
  name: string;
}

export interface Room extends FirebaseDocument {
  name: string;
  homeId?: string; // May not be needed if always fetched via subcollection path
  createdAt: Timestamp;
  objectNames: string[] | null; // Changed from objectDescription
  isAnalyzing?: boolean;
  lastAnalyzedAt?: Timestamp | null; // Allow null for cleared results
}

export interface CreateRoomData {
  name: string;
}

export interface PhotoUploadData {
  photoDataUris: string[];
}
