
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
  tenantPhotoUrls: string[]; // These are the URLs of photos taken by the tenant for this room during THIS inspection.
  discrepancies: InspectionDiscrepancy[];
  missingItemSuggestionForRoom: string; // AI's suggestion specific to this room based on tenant's photo
}

export interface InspectionReport extends FirebaseDocument {
  houseId: string;
  homeOwnerName: string; // Owner's display name at the time of link creation
  homeName: string;
  inspectedBy: string; // Tenant's name as entered on the inspection form
  inspectionDate: Timestamp; // Date of report submission
  rooms: RoomInspectionReportData[];
  overallStatus: string; // e.g., "Completed with discrepancies"
  tenantLinkId: string; // Link ID used for this inspection - NOW REQUIRED
}

// For Tenant Inspection Links (stored as subcollection under homes)
export interface TenantInspectionLink extends FirebaseDocument {
  homeId: string;
  ownerDisplayName: string; // Home owner's display name (snapshot)
  tenantName: string;       // Intended tenant's name (for display/reference)
  createdAt: Timestamp;
  validUntil?: Timestamp | null; // Optional expiry
  isActive: boolean;
  accessCount: number;
  lastAccessedAt?: Timestamp | null;
  reportId?: string | null; // ID of the InspectionReport once submitted
}

export interface CreateTenantInspectionLinkData {
  tenantName: string;
  validityDurationDays?: number | null; // How many days the link is valid for
}

