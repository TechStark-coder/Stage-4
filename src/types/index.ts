
import type { Timestamp } from "firebase/firestore";

export interface FirebaseDocument {
  id: string;
}

export interface Home extends FirebaseDocument {
  name: string;
  ownerId: string;
  ownerDisplayName?: string;
  ownerEmail?: string; // Added owner's email
  createdAt: Timestamp;
  coverImageUrl?: string;
  address?: string;
}

export interface CreateHomeData {
  name: string;
  address?: string;
  ownerDisplayName?: string;
  ownerEmail: string; // Made ownerEmail required for new homes
}

export interface UpdateHomeData {
  name?: string;
  address?: string | null;
  ownerDisplayName?: string;
  // ownerEmail could be updated here too if needed, but not in current scope
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
  expectedItems: Array<{ name: string; count: number }>;
  discrepancies: InspectionDiscrepancy[];
  missingItemSuggestionForRoom: string;
  tenantNotes?: string;
}

export interface InspectionReport extends FirebaseDocument {
  houseId: string;
  homeOwnerName: string;
  homeName: string;
  inspectedBy: string;
  inspectionDate: Timestamp;
  rooms: RoomInspectionReportData[];
  overallStatus: string;
  tenantLinkId: string;
}

// For Tenant Inspection Links
export interface TenantInspectionLink extends FirebaseDocument {
  homeId: string;
  ownerDisplayName: string;
  tenantName: string;
  createdAt: Timestamp;
  validUntil?: Timestamp | null;
  isActive: boolean;
  accessCount: number;
  lastAccessedAt?: Timestamp | null;
  reportId?: string | null;
}

export interface CreateTenantInspectionLinkData {
  tenantName: string;
}
