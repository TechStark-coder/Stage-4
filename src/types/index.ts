
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
  objectDescription: string | null;
  isAnalyzing?: boolean;
  lastAnalyzedAt?: Timestamp;
}

export interface CreateRoomData {
  name: string;
}

export interface PhotoUploadData {
  photoDataUris: string[];
}
