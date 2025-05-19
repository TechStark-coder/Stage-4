
import type { Timestamp } from "firebase/firestore";

export interface FirebaseDocument {
  id: string;
}

export interface Home extends FirebaseDocument {
  name: string;
  ownerId: string;
  createdAt: Timestamp;
  coverImageUrl?: string; // Added for home cover image
}

export interface CreateHomeData {
  name: string;
  coverImage?: File | null; // For handling file upload in form
  coverImageUrl?: string; // For storing URL in Firestore
}

export interface Room extends FirebaseDocument {
  name: string;
  homeId?: string; // May not be needed if always fetched via subcollection path
  createdAt: Timestamp;
  objectNames: string[] | null; 
  isAnalyzing?: boolean;
  lastAnalyzedAt?: Timestamp | null; 
}

export interface CreateRoomData {
  name: string;
}

export interface PhotoUploadData {
  photoDataUris: string[];
}
