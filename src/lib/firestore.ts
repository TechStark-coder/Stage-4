
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
  increment, // Import increment
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
      // Path is after /o/ and before ?alt=media (if present)
      // Example: /v0/b/project-id.appspot.com/o/homeCovers%2FuserId%2FhomeId%2Fimage.jpg?alt=media&token=...
      // We need "homeCovers/userId/homeId/image.jpg"
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
  if (!homeSnap.exists() || homeSnap.data()?.ownerId !== userId) { // Ensure owner is making the change
    throw new Error("Home not found or permission denied for update.");
  }
  const currentHomeData = homeSnap.data() as Home;

  const updateData: any = {};
  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.ownerDisplayName !== undefined) { // Allow owner to update their displayed name for the home
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

  if (homeSnap.exists()) {
    const homeData = homeSnap.data() as Home;
    if (homeData.ownerId !== userId) {
      throw new Error("Permission denied to delete this home.");
    }
    if (homeData.coverImageUrl) {
      await safeDeleteStorageObject(homeData.coverImageUrl);
    }
    // Delete the entire home cover image folder
    await deleteFolderContents(`homeCovers/${userId}/${homeId}`);
  } else {
    throw new Error("Home not found for deletion.");
  }

  const batch = writeBatch(db);

  // Delete rooms and their associated storage files
  const roomsCollectionRef = collection(db, `homes/${homeId}/rooms`);
  const roomsSnapshot = await getDocs(roomsCollectionRef);
  for (const roomDoc of roomsSnapshot.docs) {
    const roomData = roomDoc.data() as Room;
    // Delete all files in the specific room's storage folder
    await deleteFolderContents(`roomAnalysisPhotos/${userId}/${roomDoc.id}`);
    batch.delete(roomDoc.ref);
  }

  // Delete tenant inspection links
  const linksCollectionRef = collection(db, `homes/${homeId}/tenantInspectionLinks`);
  const linksSnapshot = await getDocs(linksCollectionRef);
  linksSnapshot.forEach(linkDoc => batch.delete(linkDoc.ref));

  // Delete inspection reports associated with this home
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
    analyzedObjects: [], // Initialize as empty array
    isAnalyzing: false,
    lastAnalyzedAt: null,
    analyzedPhotoUrls: [],
  });
  return docRef.id;
}

export async function updateRoom(homeId: string, roomId: string, data: UpdateRoomData): Promise<void> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
  // Add check: ensure user owns parent home before updating room
  const home = await getHome(homeId);
  if (!home) throw new Error("Parent home not found for room update.");
  // Assuming updateRoom is called by authenticated user who owns the home.
  // If rules allow others, add request.auth.uid check here.
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
  userId: string // Pass userId to construct correct storage paths if clearing old photos
): Promise<void> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomDocRef);
    if (!roomSnap.exists()) {
      throw new Error("Room not found for updating analysis data.");
    }
    const roomData = roomSnap.data() as Room;

    // Delete old photos ONLY if new ones are being added to replace them for THIS analysis.
    // This assumes a full replacement of photos for each new analysis.
    if (roomData.analyzedPhotoUrls && roomData.analyzedPhotoUrls.length > 0 && newlyUploadedPhotoUrls.length > 0) {
      for (const url of roomData.analyzedPhotoUrls) {
        await safeDeleteStorageObject(url); // Uses the helper to derive path from URL
      }
    }
    // The new set of photos for this analysis are the newlyUploadedPhotoUrls
    const finalPhotoUrls = newlyUploadedPhotoUrls;

    transaction.update(roomDocRef, {
      analyzedObjects: analyzedObjectsData,
      isAnalyzing: false,
      lastAnalyzedAt: serverTimestamp(),
      analyzedPhotoUrls: finalPhotoUrls, // Store only the URLs from the current analysis
    });
  });
}


export async function clearRoomAnalysisData(homeId: string, roomId: string, userId: string): Promise<void> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
  const roomSnap = await getDoc(roomDocRef);
  if (roomSnap.exists()) {
    const roomData = roomSnap.data() as Room;
    if (roomData.analyzedPhotoUrls && roomData.analyzedPhotoUrls.length > 0) {
      for (const url of roomData.analyzedPhotoUrls) {
         await safeDeleteStorageObject(url);
      }
    }
    // Also, consider deleting the entire folder for this room under the user
    await deleteFolderContents(`roomAnalysisPhotos/${userId}/${roomId}`);
  }
  await updateDoc(roomDocRef, {
    analyzedObjects: [], // Clear to empty array
    isAnalyzing: false,
    lastAnalyzedAt: null,
    analyzedPhotoUrls: [], // Clear to empty array
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
  // Delete all files in the specific room's storage folder first
  await deleteFolderContents(`roomAnalysisPhotos/${userId}/${roomId}`);
  await deleteDoc(roomDocRef);
}

// Users
export async function getUserEmail(userId: string): Promise<string | null> {
  const userDocRef = doc(db, "users", userId);
  const docSnap = await getDoc(userDocRef);
  if (docSnap.exists()) {
    const userData = docSnap.data();
    return userData?.email || null;
  }
  console.warn(`User document not found for ID: ${userId} when trying to get email.`);
  return null;
}


// Inspection Reports
export async function saveInspectionReport(reportData: Omit<InspectionReport, 'id' | 'inspectionDate'>): Promise<string> {
  const inspectionsCollectionRef = collection(db, "inspections");
  const docRef = await addDoc(inspectionsCollectionRef, {
    ...reportData, // This now includes tenantLinkId
    inspectionDate: serverTimestamp(),
  });
  return docRef.id;
}

// Tenant Inspection Links
export async function addTenantInspectionLink(
  homeId: string,
  ownerId: string, // Need ownerId to verify permission if rules require it
  linkData: CreateTenantInspectionLinkData
): Promise<TenantInspectionLink> {
  const home = await getHome(homeId);
  if (!home || home.ownerId !== ownerId) {
    throw new Error("Permission denied or home not found.");
  }

  const linksCollectionRef = collection(db, "homes", homeId, "tenantInspectionLinks");
  const newLinkRef = doc(linksCollectionRef);

  let validUntil: Timestamp | null = null;
  if (linkData.validityDurationDays && linkData.validityDurationDays > 0) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + linkData.validityDurationDays);
    validUntil = Timestamp.fromDate(expiryDate);
  }

  const newLink: Omit<TenantInspectionLink, 'id'> = {
    homeId: homeId,
    ownerDisplayName: home.ownerDisplayName || "Home Owner",
    tenantName: linkData.tenantName,
    createdAt: serverTimestamp() as Timestamp, // Cast for type consistency initially
    isActive: true,
    accessCount: 0,
    lastAccessedAt: null,
    validUntil: validUntil,
    reportId: null,
  };

  await setDoc(newLinkRef, newLink);
  return { id: newLinkRef.id, ...newLink } as TenantInspectionLink; // Ensure createdAt is treated as Timestamp
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
  if (docSnap.exists() && docSnap.data()?.isActive) { // Check if active server-side too
    return { id: docSnap.id, ...docSnap.data() } as TenantInspectionLink;
  }
  return null;
}

export async function deactivateTenantInspectionLink(homeId: string, linkId: string): Promise<void> {
  const linkDocRef = doc(db, "homes", homeId, "tenantInspectionLinks", linkId);
  // Security rules should verify if the unauthenticated user can do this (e.g., only if link is active)
  await updateDoc(linkDocRef, {
    isActive: false,
    // lastAccessedAt: serverTimestamp(), // Optionally update last access time
  });
}

export async function recordTenantInspectionLinkAccess(homeId: string, linkId: string): Promise<void> {
  const linkDocRef = doc(db, "homes", homeId, "tenantInspectionLinks", linkId);
  // Security rules will prevent this update if the link is not active or doesn't exist.
  try {
    await updateDoc(linkDocRef, {
      accessCount: increment(1),
      lastAccessedAt: serverTimestamp(),
    });
    console.log(`Access recorded for tenant inspection link ${linkId} for home ${homeId}.`);
  } catch (error) {
    console.error(`Error recording access for tenant inspection link ${linkId}:`, error);
    throw error; // Re-throw to be handled by the caller, page will show error.
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
    const q = query(linksRef, where("isActive", "==", true), limit(10)); // Limit to check existence efficiently
    const snapshot = await getDocs(q);
    return snapshot.size;
}

// New function to get multiple inspection reports for a given home
export async function getInspectionReportsForHome(homeId: string, userId: string): Promise<InspectionReport[]> {
    const home = await getHome(homeId);
    if (!home || home.ownerId !== userId) {
        console.error("Permission denied or home not found for fetching reports.");
        return []; // Return empty if user doesn't own home or home not found
    }

    const reportsCollectionRef = collection(db, "inspections");
    // Query for reports matching the houseId, order by inspectionDate descending
    const q = query(reportsCollectionRef, where("houseId", "==", homeId), orderBy("inspectionDate", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    } as InspectionReport));
}

// New function to get a single inspection report by its ID
export async function getInspectionReport(reportId: string, userId: string): Promise<InspectionReport | null> {
    const reportDocRef = doc(db, "inspections", reportId);
    const reportSnap = await getDoc(reportDocRef);

    if (reportSnap.exists()) {
        const reportData = reportSnap.data() as InspectionReport;
        // Verify user owns the home associated with this report
        const home = await getHome(reportData.houseId);
        if (home && home.ownerId === userId) {
            return { id: reportSnap.id, ...reportData } as InspectionReport;
        } else {
            console.error("Permission denied: User does not own the home associated with this report.");
            return null;
        }
    }
    return null;
}

// New function to delete an inspection report
export async function deleteInspectionReport(reportId: string, userId: string): Promise<void> {
    const reportDocRef = doc(db, "inspections", reportId);
    const reportSnap = await getDoc(reportDocRef);

    if (reportSnap.exists()) {
        const reportData = reportSnap.data() as InspectionReport;
        // Verify user owns the home associated with this report
        const home = await getHome(reportData.houseId);
        if (home && home.ownerId === userId) {
            // If there was a tenantLinkId associated and you want to re-activate it, you could do that here.
            // For now, just deleting the report.
            await deleteDoc(reportDocRef);
        } else {
            throw new Error("Permission denied to delete this inspection report.");
        }
    } else {
        throw new Error("Inspection report not found.");
    }
}
