
import type { Timestamp } from "firebase/firestore";

export interface FirebaseDocument {
  id: string;
}

export interface Home extends FirebaseDocument {
  name: string;
  ownerId: string;
  ownerDisplayName?: string; // Added for personalized greeting
  createdAt: Timestamp;
  coverImageUrl?: string;
  address?: string;
}

export interface CreateHomeData {
  name: string;
  address?: string;
  ownerDisplayName?: string; // To store at time of creation
}

export interface UpdateHomeData {
  name?: string;
  address?: string | null;
  ownerDisplayName?: string; // Could be updated if needed
}


export interface Room extends FirebaseDocument {
  name: string;
  homeId?: string; 
  createdAt: Timestamp;
  analyzedObjects: Array<{ name: string; count: number }> | null; 
  isAnalyzing?: boolean;
  lastAnalyzedAt?: Timestamp | null;
  analyzedPhotoUrls?: string[]; 
}

export interface CreateRoomData {
  name:string;
}

export interface UpdateRoomData {
  name?: string;
}

// For the new inspection flow
export interface InspectionDiscrepancy {
  name: string;
  expectedCount: number;
  actualCount: number;
  note: string;
}

export interface RoomInspectionReportData {
  roomId: string;
  roomName: string;
  tenantPhotoUrls: string[];
  discrepancies: InspectionDiscrepancy[];
  missingItemSuggestionForRoom: string;
}

export interface InspectionReport extends FirebaseDocument {
  houseId: string;
  homeOwnerName: string; // Owner's display name
  homeName: string;
  inspectedBy: string; // Tenant's name
  inspectionDate: Timestamp;
  rooms: RoomInspectionReportData[];
  overallStatus: string; // e.g., "Completed with discrepancies"
}
