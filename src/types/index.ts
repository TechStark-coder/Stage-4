
import type { Timestamp } from "firebase/firestore";

export interface FirebaseDocument {
  id: string;
}

export interface Home extends FirebaseDocument {
  name: string;
  ownerId: string;
  createdAt: Timestamp;
  coverImageUrl?: string; // URL from Firebase Storage
  description?: string; // New optional description field
}

export interface CreateHomeData {
  name: string;
  description?: string; // New optional description field
  // coverImageFile is handled in the component, not directly in this type for addHome
}

export interface UpdateHomeData {
  name?: string;
  description?: string; // New optional description field
  // coverImageFile is handled in the component
}


export interface Room extends FirebaseDocument {
  name: string;
  homeId?: string; // Optional if rooms collection is directly under homes/{homeId}/rooms
  createdAt: Timestamp;
  objectNames: string[] | null;
  isAnalyzing?: boolean;
  lastAnalyzedAt?: Timestamp | null;
  analyzedPhotoUrls?: string[]; // URLs from Firebase Storage
}

export interface CreateRoomData {
  name:string;
}

export interface UpdateRoomData {
  name?: string;
}
