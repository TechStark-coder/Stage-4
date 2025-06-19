
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  setDoc,
  deleteField,
  increment, // Ensure increment is imported
  runTransaction,
  collectionGroup,
  limit,
} from "firebase/firestore";
import { db, storage } from "@/config/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage";
import type { Home, Room, CreateHomeData, CreateRoomData, UpdateHomeData, UpdateRoomData, InspectionReport, TenantInspectionLink, CreateTenantInspectionLinkData } from "@/types";

// Helper function to safely delete from Firebase Storage, handling full URLs
const safeDeleteStorageObject = async (fileUrlOrPath: string) => {
  if (!fileUrlOrPath) return;
  let storageRefPath: string;

  if (fileUrlOrPath.startsWith('gs://') || !fileUrlOrPath.includes('firebasestorage.googleapis.com')) {
    storageRefPath = fileUrlOrPath;
  } else {
    try {
      const url = new URL(fileUrlOrPath);
      const decodedPathName = decodeURIComponent(url.pathname);
      storageRefPath = decodedPathName.substring(decodedPathName.indexOf('/o/') + 3).split('?')[0];

    } catch (error) {
      console.error("Invalid URL, cannot extract path for deletion:", fileUrlOrPath, error);
      return;
    }
  }

  try {
    const storageRefInstance = ref(storage, storageRefPath);
    await deleteObject(storageRefInstance);
    console.log("Successfully deleted from Firebase Storage:", storageRefPath);
  } catch (error: any) {
    if (error.code === 'storage/object-not-found') {
      console.log("Object not found in Firebase Storage (already deleted or path issue?):", storageRefPath);
    } else {
      console.error("Error deleting object from Firebase Storage:", storageRefPath, error);
    }
  }
};

const deleteFolderContents = async (folderPath: string) => {
  const folderRef = ref(storage, folderPath);
  try {
    const listResults = await listAll(folderRef);
    const deletePromises: Promise<void>[] = [];
    listResults.items.forEach(itemRef => deletePromises.push(deleteObject(itemRef)));
    listResults.prefixes.forEach(subFolderRef => deletePromises.push(deleteFolderContents(subFolderRef.fullPath)));
    await Promise.all(deletePromises);
    console.log(`Successfully deleted contents of folder: ${folderPath}`);
  } catch (error) {
    console.error(`Error deleting contents of folder ${folderPath}:`, error);
    // Do not re-throw, allow Firestore deletions to proceed if storage deletion fails partially
  }
};


// Homes
export async function addHome(
  userId: string,
  data: CreateHomeData,
  coverImageFile?: File | null
): Promise<string> {
  const homesCollectionRef = collection(db, "homes");
  const newHomeRef = doc(homesCollectionRef);

  let coverImageUrl: string | undefined = undefined;
  if (coverImageFile && userId) {
    const imagePath = `homeCovers/${userId}/${newHomeRef.id}/${Date.now()}_${coverImageFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const imageStorageRef = ref(storage, imagePath);
    await uploadBytes(imageStorageRef, coverImageFile);
    coverImageUrl = await getDownloadURL(imageStorageRef);
  }

  const homeDataToSave: any = {
    name: data.name,
    ownerId: userId,
    ownerDisplayName: data.ownerDisplayName || "Home Owner",
    ownerEmail: data.ownerEmail,
    createdAt: serverTimestamp(),
  };

  if (data.address) {
    homeDataToSave.address = data.address;
  }
  if (coverImageUrl) {
    homeDataToSave.coverImageUrl = coverImageUrl;
  }

  await setDoc(newHomeRef, homeDataToSave);
  return newHomeRef.id;
}

export async function updateHome(
  homeId: string,
  userId: string,
  data: UpdateHomeData,
  newCoverImageFile?: File | null
): Promise<void> {
  const homeDocRef = doc(db, "homes", homeId);
  const homeSnap = await getDoc(homeDocRef);
  if (!homeSnap.exists() || homeSnap.data()?.ownerId !== userId) {
    throw new Error("Home not found or permission denied for update.");
  }
  const currentHomeData = homeSnap.data() as Home;

  const updateData: any = {};
  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.ownerDisplayName !== undefined) {
    updateData.ownerDisplayName = data.ownerDisplayName;
  }
  if (data.address !== undefined) {
    updateData.address = data.address === null ? deleteField() : data.address;
  }

  if (newCoverImageFile) {
    if (currentHomeData.coverImageUrl) {
      await safeDeleteStorageObject(currentHomeData.coverImageUrl);
    }
    const imagePath = `homeCovers/${userId}/${homeId}/${Date.now()}_${newCoverImageFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const imageStorageRef = ref(storage, imagePath);
    await uploadBytes(imageStorageRef, newCoverImageFile);
    updateData.coverImageUrl = await getDownloadURL(imageStorageRef);
  }

  if (Object.keys(updateData).length > 0) {
    await updateDoc(homeDocRef, updateData);
  }
}

export async function removeHomeCoverImage(homeId: string, userId: string): Promise<void> {
  const homeDocRef = doc(db, "homes", homeId);
  const homeSnap = await getDoc(homeDocRef);
  if (homeSnap.exists()) {
    const homeData = homeSnap.data() as Home;
    if (homeData.ownerId !== userId) throw new Error("Permission denied to remove cover image.");
    if (homeData.coverImageUrl) {
      await safeDeleteStorageObject(homeData.coverImageUrl);
      await updateDoc(homeDocRef, { coverImageUrl: deleteField() });
    }
  } else {
    throw new Error("Home not found.");
  }
}


export async function getHomes(userId: string): Promise<Home[]> {
  const homesCollectionRef = collection(db, "homes");
  const q = query(homesCollectionRef, where("ownerId", "==", userId), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as Home));
}

export async function getHome(homeId: string): Promise<Home | null> {
  const homeDocRef = doc(db, "homes", homeId);
  const docSnap = await getDoc(homeDocRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Home;
  }
  return null;
}

export async function deleteHome(homeId: string, userId: string): Promise<void> {
  const homeDocRef = doc(db, "homes", homeId);
  const homeSnap = await getDoc(homeDocRef);
  let ownerIdToDelete = userId; // Default to the deleter's ID

  if (homeSnap.exists()) {
    const homeData = homeSnap.data() as Home;
    if (homeData.ownerId !== userId) {
      throw new Error("Permission denied to delete this home. You are not the owner.");
    }
    ownerIdToDelete = homeData.ownerId; // Use the confirmed ownerId from the document

    if (homeData.coverImageUrl) {
      await safeDeleteStorageObject(homeData.coverImageUrl);
    }
    // Delete home cover image folder contents
    await deleteFolderContents(`homeCovers/${ownerIdToDelete}/${homeId}`);
  } else {
    // If home doesn't exist or user can't read it, we might still try to delete related folders if we have an ID.
    // However, without homeData.ownerId, constructing storage paths is problematic.
    // This error indicates the initial check failed.
    throw new Error("Home not found for deletion, or you do not have permission to access its details.");
  }

  const batch = writeBatch(db);

  // Delete rooms and their storage
  const roomsCollectionRef = collection(db, `homes/${homeId}/rooms`);
  const roomsSnapshot = await getDocs(roomsCollectionRef);
  for (const roomDoc of roomsSnapshot.docs) {
    await deleteFolderContents(`roomAnalysisPhotos/${ownerIdToDelete}/${roomDoc.id}`);
    batch.delete(roomDoc.ref);
  }

  // Delete tenant inspection links
  const linksCollectionRef = collection(db, `homes/${homeId}/tenantInspectionLinks`);
  const linksSnapshot = await getDocs(linksCollectionRef);
  linksSnapshot.forEach(linkDoc => batch.delete(linkDoc.ref));

  // Delete inspection reports
  const inspectionsCollectionRef = collection(db, "inspections");
  const reportsQuery = query(inspectionsCollectionRef, where("houseId", "==", homeId));
  const reportsSnapshot = await getDocs(reportsQuery);
  reportsSnapshot.forEach(reportDoc => batch.delete(reportDoc.ref));

  // Delete the home document itself
  batch.delete(homeDocRef);

  await batch.commit();
}


// Rooms
export async function addRoom(homeId: string, data: CreateRoomData): Promise<string> {
  const roomsCollectionRef = collection(db, "homes", homeId, "rooms");
  const docRef = await addDoc(roomsCollectionRef, {
    ...data,
    createdAt: serverTimestamp(),
    analyzedObjects: [],
    isAnalyzing: false,
    lastAnalyzedAt: null,
    analyzedPhotoUrls: [],
  });
  return docRef.id;
}

export async function updateRoom(homeId: string, roomId: string, data: UpdateRoomData): Promise<void> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
  // Optional: Add a check to ensure the home exists or user has permission if needed
  // const home = await getHome(homeId);
  // if (!home) throw new Error("Parent home not found for room update.");
  await updateDoc(roomDocRef, data);
}

export async function getRooms(homeId: string): Promise<Room[]> {
  const roomsCollectionRef = collection(db, "homes", homeId, "rooms");
  const q = query(roomsCollectionRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as Room));
}

export async function getRoom(homeId: string, roomId: string): Promise<Room | null> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
  const docSnap = await getDoc(roomDocRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Room;
  }
  return null;
}

export async function updateRoomAnalysisData(
  homeId: string,
  roomId: string,
  analyzedObjectsData: Array<{ name: string; count: number }>,
  newlyUploadedPhotoUrls: string[],
  userId: string // userId of the uploader, for storage path or logging if needed
): Promise<void> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomDocRef);
    if (!roomSnap.exists()) {
      throw new Error("Room not found for updating analysis data.");
    }
    const roomData = roomSnap.data() as Room;

    // Combine existing and new URLs, avoiding duplicates
    const existingUrls = new Set(roomData.analyzedPhotoUrls || []);
    newlyUploadedPhotoUrls.forEach(url => existingUrls.add(url));
    const finalPhotoUrls = Array.from(existingUrls);

    transaction.update(roomDocRef, {
      analyzedObjects: analyzedObjectsData,
      isAnalyzing: false,
      lastAnalyzedAt: serverTimestamp(),
      analyzedPhotoUrls: finalPhotoUrls,
    });
  });
}


export async function clearRoomAnalysisData(homeId: string, roomId: string, userId: string): Promise<void> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
  const roomSnap = await getDoc(roomDocRef);
  if (roomSnap.exists()) {
    const roomData = roomSnap.data() as Room;
    // Delete from storage: all photos listed in analyzedPhotoUrls
    if (roomData.analyzedPhotoUrls && roomData.analyzedPhotoUrls.length > 0) {
      for (const url of roomData.analyzedPhotoUrls) {
         await safeDeleteStorageObject(url);
      }
    }
    // Also attempt to delete the entire folder for this room under the user
    // This helps catch any orphaned files not in analyzedPhotoUrls
    await deleteFolderContents(`roomAnalysisPhotos/${userId}/${roomId}`);
  }
  // Update Firestore document
  await updateDoc(roomDocRef, {
    analyzedObjects: [],
    isAnalyzing: false,
    lastAnalyzedAt: null,
    analyzedPhotoUrls: [],
  });
}

export async function setRoomAnalyzingStatus(
  homeId: string,
  roomId: string,
  isAnalyzing: boolean
): Promise<void> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
  await updateDoc(roomDocRef, { isAnalyzing });
}

export async function deleteRoom(homeId: string, roomId: string, userId: string): Promise<void> {
  const roomDocRef = doc(db, `homes/${homeId}/rooms`, roomId);
  // Delete associated storage folder for the room
  await deleteFolderContents(`roomAnalysisPhotos/${userId}/${roomId}`);
  await deleteDoc(roomDocRef);
}

// Inspection Reports
export async function saveInspectionReport(reportData: Omit<InspectionReport, 'id' | 'inspectionDate'>): Promise<string> {
  const inspectionsCollectionRef = collection(db, "inspections");
  const docRef = await addDoc(inspectionsCollectionRef, {
    ...reportData,
    inspectionDate: serverTimestamp(),
  });
  return docRef.id;
}

// Tenant Inspection Links
export async function addTenantInspectionLink(
  homeId: string,
  currentUserId: string, // User ID of the owner creating the link
  linkData: CreateTenantInspectionLinkData
): Promise<TenantInspectionLink> {
  const home = await getHome(homeId);
  if (!home || home.ownerId !== currentUserId) {
    throw new Error("Permission denied: You do not own this home or the home was not found.");
  }

  const linksCollectionRef = collection(db, "homes", homeId, "tenantInspectionLinks");
  const newLinkRef = doc(linksCollectionRef);

  let validUntil: Timestamp | null = null;
  if (linkData.validityDurationDays && linkData.validityDurationDays > 0) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + linkData.validityDurationDays);
    validUntil = Timestamp.fromDate(expiryDate);
  }

  const newLinkData: Omit<TenantInspectionLink, 'id'> = {
    homeId: homeId,
    ownerDisplayName: home.ownerDisplayName || "Home Owner", // Use owner's display name from home doc
    tenantName: linkData.tenantName,
    createdAt: serverTimestamp() as Timestamp,
    isActive: true,
    accessCount: 0,
    lastAccessedAt: null,
    validUntil: validUntil,
    reportId: null,
  };

  await setDoc(newLinkRef, newLinkData);
  return { id: newLinkRef.id, ...newLinkData } as TenantInspectionLink;
}

export async function getTenantInspectionLinks(homeId: string, ownerId: string): Promise<TenantInspectionLink[]> {
  const home = await getHome(homeId);
  if (!home || home.ownerId !== ownerId) {
    throw new Error("Permission denied or home not found.");
  }
  const linksCollectionRef = collection(db, "homes", homeId, "tenantInspectionLinks");
  const q = query(linksCollectionRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TenantInspectionLink));
}

export async function getTenantInspectionLink(homeId: string, linkId: string): Promise<TenantInspectionLink | null> {
  const linkDocRef = doc(db, "homes", homeId, "tenantInspectionLinks", linkId);
  const docSnap = await getDoc(linkDocRef);
  // Important: Return the link data even if !isActive, the client page can then decide how to handle an inactive link.
  // The security rules will prevent reading if !isActive for an unauthenticated user.
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as TenantInspectionLink;
  }
  return null;
}

export async function deactivateTenantInspectionLink(homeId: string, linkId: string): Promise<void> {
  const linkDocRef = doc(db, "homes", homeId, "tenantInspectionLinks", linkId);
  // Check if link exists before attempting to update
  const linkSnap = await getDoc(linkDocRef);
  if (!linkSnap.exists()) {
    throw new Error("Tenant inspection link not found for deactivation.");
  }
  await updateDoc(linkDocRef, {
    isActive: false,
  });
}

export async function recordTenantInspectionLinkAccess(homeId: string, linkId: string): Promise<void> {
  const linkDocRef = doc(db, "homes", homeId, "tenantInspectionLinks", linkId);
  try {
    // First, get the link to ensure it exists and is active before trying to update.
    // Firestore security rules should prevent this read if the link is not active for an unauth user.
    const linkSnap = await getDoc(linkDocRef);
    if (!linkSnap.exists()) {
        throw new Error("Inspection link not found.");
    }
    if (linkSnap.data()?.isActive !== true) {
        throw new Error("Inspection link is not active.");
    }

    await updateDoc(linkDocRef, {
      accessCount: increment(1),
      lastAccessedAt: serverTimestamp(),
    });
    console.log(`Access recorded for tenant inspection link ${linkId} for home ${homeId}.`);
  } catch (error) {
    console.error(`Error recording access for tenant inspection link ${linkId}:`, error);
    throw error; // Re-throw to be caught by the calling page
  }
}

export async function deleteTenantInspectionLink(homeId: string, linkId: string, ownerId: string): Promise<void> {
  const home = await getHome(homeId);
  if (!home || home.ownerId !== ownerId) {
    throw new Error("Permission denied or home not found.");
  }
  const linkDocRef = doc(db, "homes", homeId, "tenantInspectionLinks", linkId);
  await deleteDoc(linkDocRef);
}

export async function getActiveTenantInspectionLinksCount(homeId: string): Promise<number> {
    const linksRef = collection(db, `homes/${homeId}/tenantInspectionLinks`);
    const q = query(linksRef, where("isActive", "==", true), limit(10)); // Limit query for performance
    const snapshot = await getDocs(q);
    return snapshot.size;
}

export async function getInspectionReportsForHome(homeId: string, userId: string): Promise<InspectionReport[]> {
    const home = await getHome(homeId);
    if (!home || home.ownerId !== userId) {
        console.error("Permission denied or home not found for fetching reports.");
        return [];
    }

    const reportsCollectionRef = collection(db, "inspections");
    const q = query(reportsCollectionRef, where("houseId", "==", homeId), orderBy("inspectionDate", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    } as InspectionReport));
}

export async function getInspectionReport(reportId: string, userId: string): Promise<InspectionReport | null> {
    const reportDocRef = doc(db, "inspections", reportId);
    const reportSnap = await getDoc(reportDocRef);

    if (reportSnap.exists()) {
        const reportData = reportSnap.data() as InspectionReport;
        const home = await getHome(reportData.houseId);
        if (home && home.ownerId === userId) { // Check if the user owns the associated home
            return { id: reportSnap.id, ...reportData } as InspectionReport;
        } else {
            console.error("Permission denied: User does not own the home associated with this report.");
            return null;
        }
    }
    return null;
}

export async function deleteInspectionReport(reportId: string, userId: string): Promise<void> {
    const reportDocRef = doc(db, "inspections", reportId);
    const reportSnap = await getDoc(reportDocRef);

    if (reportSnap.exists()) {
        const reportData = reportSnap.data() as InspectionReport;
        const home = await getHome(reportData.houseId); // Get the home associated with the report
        if (home && home.ownerId === userId) { // Check if the current user owns that home
            await deleteDoc(reportDocRef);
        } else {
            throw new Error("Permission denied to delete this inspection report.");
        }
    } else {
        throw new Error("Inspection report not found.");
    }
}
