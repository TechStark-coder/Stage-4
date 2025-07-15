
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
  increment, 
  runTransaction,
  collectionGroup,
  limit,
  arrayRemove, 
  arrayUnion, 
  FirestoreError,
} from "firebase/firestore";
import { db, storage } from "@/config/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage";
import type { Home, Room, CreateHomeData, CreateRoomData, UpdateHomeData, UpdateRoomData, InspectionReport, TenantInspectionLink, CreateTenantInspectionLinkData, DescribeRoomObjectsOutput } from "@/types";

// --- New Error Handling Helper ---
const handleFirestoreError = (error: any, context: string): Error => {
  console.error(`Firestore Error in ${context}:`, error);
  let userMessage = `An error occurred in ${context}. Please check the console for details.`;

  if (error instanceof FirestoreError) {
    if (error.code === 'unavailable') {
      userMessage = 'Could not connect to the database. Please check your internet connection and ensure your Firebase project configuration in the .env file is correct.';
    } else if (error.code === 'permission-denied') {
      userMessage = 'Permission denied. Please check your Firestore security rules in the Firebase console.';
    }
  } else if (error.message.includes('network')) {
     userMessage = 'Network error. Please check your internet connection.';
  }
  
  // Return a new Error object with a user-friendly message
  return new Error(userMessage);
};


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
  }
};


// Homes
export async function addHome(
  userId: string,
  data: CreateHomeData,
  coverImageFile?: File | null
): Promise<string> {
  try {
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
  } catch (error) {
    throw handleFirestoreError(error, 'adding home');
  }
}

export async function updateHome(
  homeId: string,
  userId: string,
  data: UpdateHomeData,
  newCoverImageFile?: File | null
): Promise<void> {
  try {
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
  } catch (error) {
    throw handleFirestoreError(error, 'updating home');
  }
}

export async function removeHomeCoverImage(homeId: string, userId: string): Promise<void> {
  try {
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
  } catch (error) {
    throw handleFirestoreError(error, 'removing cover image');
  }
}


export async function getHomes(userId: string): Promise<Home[]> {
  try {
    const homesCollectionRef = collection(db, "homes");
    const q = query(homesCollectionRef, where("ownerId", "==", userId), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Home));
  } catch (error) {
    throw handleFirestoreError(error, 'getting homes');
  }
}

export async function getHome(homeId: string): Promise<Home | null> {
  try {
    const homeDocRef = doc(db, "homes", homeId);
    const docSnap = await getDoc(homeDocRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Home;
    }
    return null;
  } catch (error) {
    throw handleFirestoreError(error, `getting home (ID: ${homeId})`);
  }
}

export async function deleteHome(homeId: string, userId: string): Promise<void> {
  try {
    const homeDocRef = doc(db, "homes", homeId);
    const homeSnap = await getDoc(homeDocRef);
    let ownerIdToDelete = userId; 

    if (homeSnap.exists()) {
      const homeData = homeSnap.data() as Home;
      if (homeData.ownerId !== userId) {
        throw new Error("Permission denied to delete this home. You are not the owner.");
      }
      ownerIdToDelete = homeData.ownerId; 

      if (homeData.coverImageUrl) {
        await safeDeleteStorageObject(homeData.coverImageUrl);
      }
      await deleteFolderContents(`homeCovers/${ownerIdToDelete}/${homeId}`);
    } else {
      throw new Error("Home not found for deletion, or you do not have permission to access its details.");
    }

    const batch = writeBatch(db);

    const roomsCollectionRef = collection(db, `homes/${homeId}/rooms`);
    const roomsSnapshot = await getDocs(roomsCollectionRef);
    for (const roomDoc of roomsSnapshot.docs) {
      await deleteFolderContents(`roomAnalysis/${ownerIdToDelete}/${roomDoc.id}`);
      batch.delete(roomDoc.ref);
    }

    const linksCollectionRef = collection(db, `homes/${homeId}/tenantInspectionLinks`);
    const linksSnapshot = await getDocs(linksCollectionRef);
    linksSnapshot.forEach(linkDoc => batch.delete(linkDoc.ref));

    const inspectionsCollectionRef = collection(db, "inspections");
    const reportsQuery = query(inspectionsCollectionRef, where("houseId", "==", homeId));
    const reportsSnapshot = await getDocs(reportsQuery);
    reportsSnapshot.forEach(reportDoc => batch.delete(reportDoc.ref));

    batch.delete(homeDocRef);

    await batch.commit();
  } catch (error) {
    throw handleFirestoreError(error, 'deleting home');
  }
}


// Rooms
export async function addRoom(homeId: string, data: CreateRoomData): Promise<string> {
  try {
    const roomsCollectionRef = collection(db, "homes", homeId, "rooms");
    const docRef = await addDoc(roomsCollectionRef, {
      ...data,
      createdAt: serverTimestamp(),
      analyzedObjects: [],
      isAnalyzing: false,
      lastAnalyzedAt: null,
      analyzedPhotoUrls: [],
      analyzedVideoUrls: [],
    });
    return docRef.id;
  } catch (error) {
    throw handleFirestoreError(error, 'adding room');
  }
}

export async function updateRoom(homeId: string, roomId: string, data: UpdateRoomData): Promise<void> {
  try {
    const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
    await updateDoc(roomDocRef, data);
  } catch (error) {
    throw handleFirestoreError(error, 'updating room');
  }
}

export async function getRooms(homeId: string): Promise<Room[]> {
  try {
    const roomsCollectionRef = collection(db, "homes", homeId, "rooms");
    const q = query(roomsCollectionRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Room));
  } catch (error) {
    throw handleFirestoreError(error, `getting rooms for home ${homeId}`);
  }
}

export async function getRoom(homeId: string, roomId: string): Promise<Room | null> {
  try {
    const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
    const docSnap = await getDoc(roomDocRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Room;
    }
    return null;
  } catch (error) {
    throw handleFirestoreError(error, `getting room ${roomId}`);
  }
}

// --- Media Analysis Functions ---

export async function updateRoomAnalysisData(
  homeId: string,
  roomId: string,
  finalAnalyzedObjects: DescribeRoomObjectsOutput,
  finalPhotoUrls: string[],
  finalVideoUrls: string[]
): Promise<void> {
  try {
    const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
    await updateDoc(roomDocRef, {
      analyzedObjects: finalAnalyzedObjects.objects,
      isAnalyzing: false,
      lastAnalyzedAt: serverTimestamp(),
      analyzedPhotoUrls: finalPhotoUrls,
      analyzedVideoUrls: finalVideoUrls,
    });
  } catch (error) {
    throw handleFirestoreError(error, 'updating room analysis');
  }
}

export async function removeAnalyzedRoomPhoto(
  homeId: string,
  roomId: string,
  mediaUrlToRemove: string,
  userId: string 
): Promise<void> {
  try {
    const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);

    const parentHome = await getHome(homeId);
    if (!parentHome || parentHome.ownerId !== userId) {
      throw new Error("Permission denied or home not found.");
    }

    await safeDeleteStorageObject(mediaUrlToRemove);

    const roomSnap = await getDoc(roomDocRef);
    const roomData = roomSnap.data() as Room;

    const updatePayload: { [key: string]: any } = { isAnalyzing: false };
    if (roomData.analyzedPhotoUrls?.includes(mediaUrlToRemove)) {
      updatePayload.analyzedPhotoUrls = arrayRemove(mediaUrlToRemove);
    }
    if (roomData.analyzedVideoUrls?.includes(mediaUrlToRemove)) {
      updatePayload.analyzedVideoUrls = arrayRemove(mediaUrlToRemove);
    }

    await updateDoc(roomDocRef, updatePayload);
  } catch (error) {
    throw handleFirestoreError(error, 'removing analyzed media');
  }
}


export async function clearRoomAnalysisData(homeId: string, roomId: string, userId: string): Promise<void> {
  try {
    const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
    
    const parentHome = await getHome(homeId);
    if (!parentHome || parentHome.ownerId !== userId) {
      throw new Error("Permission denied or home not found.");
    }
    
    await deleteFolderContents(`roomAnalysis/${userId}/${roomId}`);
    
    await updateDoc(roomDocRef, {
      analyzedObjects: [],
      isAnalyzing: false,
      lastAnalyzedAt: null,
      analyzedPhotoUrls: [],
      analyzedVideoUrls: [],
    });
  } catch (error) {
    throw handleFirestoreError(error, 'clearing room analysis');
  }
}

export async function setRoomAnalyzingStatus(
  homeId: string,
  roomId: string,
  isAnalyzing: boolean
): Promise<void> {
  try {
    const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
    await updateDoc(roomDocRef, { isAnalyzing });
  } catch(error) {
    throw handleFirestoreError(error, 'setting analysis status');
  }
}


export async function deleteRoom(homeId: string, roomId: string, userId: string): Promise<void> {
  try {
    const roomDocRef = doc(db, `homes/${homeId}/rooms`, roomId);
    
    const parentHome = await getHome(homeId);
    if (!parentHome || parentHome.ownerId !== userId) {
      throw new Error("Permission denied or home not found.");
    }

    await deleteFolderContents(`roomAnalysis/${userId}/${roomId}`);
    await deleteDoc(roomDocRef);
  } catch (error) {
    throw handleFirestoreError(error, 'deleting room');
  }
}

// Inspection Reports
export async function saveInspectionReport(reportData: Omit<InspectionReport, 'id' | 'inspectionDate'>): Promise<string> {
  try {
    const inspectionsCollectionRef = collection(db, "inspections");
    const docRef = await addDoc(inspectionsCollectionRef, {
      ...reportData,
      inspectionDate: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    throw handleFirestoreError(error, 'saving inspection report');
  }
}

// Tenant Inspection Links
export async function addTenantInspectionLink(
  homeId: string,
  currentUserId: string, 
  linkData: CreateTenantInspectionLinkData
): Promise<TenantInspectionLink> {
  try {
    const home = await getHome(homeId);
    if (!home || home.ownerId !== currentUserId) {
      throw new Error("Permission denied: You do not own this home or the home was not found.");
    }

    const linksCollectionRef = collection(db, "homes", homeId, "tenantInspectionLinks");
    const newLinkRef = doc(linksCollectionRef);

    const newLinkData: Omit<TenantInspectionLink, 'id'> = {
      homeId: homeId,
      ownerDisplayName: home.ownerDisplayName || "Home Owner", 
      tenantName: linkData.tenantName,
      createdAt: serverTimestamp() as Timestamp,
      isActive: true,
      accessCount: 0,
      lastAccessedAt: null,
      validUntil: null,
      reportId: null,
    };

    await setDoc(newLinkRef, newLinkData);
    return { id: newLinkRef.id, ...newLinkData } as TenantInspectionLink;
  } catch (error) {
    throw handleFirestoreError(error, 'creating tenant link');
  }
}

export async function getTenantInspectionLinks(homeId: string, ownerId: string): Promise<TenantInspectionLink[]> {
  try {
    const home = await getHome(homeId);
    if (!home || home.ownerId !== ownerId) {
      throw new Error("Permission denied or home not found.");
    }
    const linksCollectionRef = collection(db, "homes", homeId, "tenantInspectionLinks");
    const q = query(linksCollectionRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TenantInspectionLink));
  } catch (error) {
    throw handleFirestoreError(error, 'getting tenant links');
  }
}

export async function getTenantInspectionLink(homeId: string, linkId: string): Promise<TenantInspectionLink | null> {
  try {
    const linkDocRef = doc(db, "homes", homeId, "tenantInspectionLinks", linkId);
    const docSnap = await getDoc(linkDocRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as TenantInspectionLink;
    }
    return null;
  } catch (error) {
    throw handleFirestoreError(error, 'getting single tenant link');
  }
}

export async function deactivateTenantInspectionLink(homeId: string, linkId: string, reportId: string): Promise<void> {
  try {
    const linkDocRef = doc(db, "homes", homeId, "tenantInspectionLinks", linkId);
    const linkSnap = await getDoc(linkDocRef);
    if (!linkSnap.exists()) {
      throw new Error("Tenant inspection link not found for deactivation.");
    }
    await updateDoc(linkDocRef, {
      isActive: false,
      reportId: reportId, 
    });
  } catch (error) {
    throw handleFirestoreError(error, 'deactivating tenant link');
  }
}

export async function reactivateTenantInspectionLink(homeId: string, linkId: string, ownerId: string): Promise<void> {
  try {
    const home = await getHome(homeId);
    if (!home || home.ownerId !== ownerId) {
      throw new Error("Permission denied or home not found.");
    }
    const linkDocRef = doc(db, "homes", homeId, "tenantInspectionLinks", linkId);
    const linkSnap = await getDoc(linkDocRef);
    if (!linkSnap.exists()) {
      console.warn(`Tenant inspection link ${linkId} not found for reactivation.`);
      return;
    }
    await updateDoc(linkDocRef, {
      isActive: true,
      reportId: null, // Clear the association with the deleted report
    });
  } catch (error) {
    throw handleFirestoreError(error, 'reactivating tenant link');
  }
}

export async function recordTenantInspectionLinkAccess(homeId: string, linkId: string): Promise<TenantInspectionLink | null> {
  const linkDocRef = doc(db, "homes", homeId, "tenantInspectionLinks", linkId);
  try {
    let linkData: TenantInspectionLink | null = null;
    await runTransaction(db, async (transaction) => {
      const linkSnap = await transaction.get(linkDocRef);
      if (!linkSnap.exists()) {
        throw new Error("Inspection link not found.");
      }
      linkData = { id: linkSnap.id, ...linkSnap.data() } as TenantInspectionLink;

      if (!linkData.isActive) {
        throw new Error("Inspection link is not active or has expired.");
      }
      if (linkData.validUntil && linkData.validUntil.toDate() < new Date()) {
        throw new Error("Inspection link has expired.");
      }

      transaction.update(linkDocRef, {
        accessCount: increment(1),
        lastAccessedAt: serverTimestamp(),
      });
    });
    console.log(`Access recorded for tenant inspection link ${linkId} for home ${homeId}.`);
    return linkData;
  } catch (error) {
    // Re-throw with user-friendly message
    if (error instanceof Error) {
        if (error.message.includes("not found")) {
           throw new Error("The inspection link ID is invalid. Please check the URL.");
        }
        if (error.message.includes("not active")) {
           throw new Error("This inspection link has already been used and is no longer active.");
        }
    }
    throw handleFirestoreError(error, `recording access for tenant link`);
  }
}


export async function deleteTenantInspectionLink(homeId: string, linkId: string, ownerId: string): Promise<void> {
  try {
    const home = await getHome(homeId);
    if (!home || home.ownerId !== ownerId) {
      throw new Error("Permission denied or home not found.");
    }
    const linkDocRef = doc(db, "homes", homeId, "tenantInspectionLinks", linkId);
    const linkSnap = await getDoc(linkDocRef);
    
    if (linkSnap.exists()) {
      // This function is now only responsible for deleting the link document itself.
      // The UI component orchestrates deleting the associated report.
      await deleteDoc(linkDocRef);
    } else {
      throw new Error("Link not found.");
    }
  } catch (error) {
    throw handleFirestoreError(error, 'deleting tenant link');
  }
}

export async function getActiveTenantInspectionLinksCount(homeId: string): Promise<number> {
  try {
    const linksRef = collection(db, `homes/${homeId}/tenantInspectionLinks`);
    const q = query(linksRef, where("isActive", "==", true), limit(10)); 
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    throw handleFirestoreError(error, 'counting active links');
  }
}

export async function getInspectionReportsForHome(homeId: string, userId: string): Promise<InspectionReport[]> {
  try {
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
  } catch (error) {
    throw handleFirestoreError(error, 'getting inspection reports');
  }
}

export async function getInspectionReport(reportId: string, userId: string): Promise<InspectionReport | null> {
  try {
    const reportDocRef = doc(db, "inspections", reportId);
    const reportSnap = await getDoc(reportDocRef);

    if (reportSnap.exists()) {
        const reportData = reportSnap.data() as InspectionReport;
        const home = await getHome(reportData.houseId);
        if (home && home.ownerId === userId) { 
            return { id: reportSnap.id, ...reportData } as InspectionReport;
        } else {
            console.error("Permission denied: User does not own the home associated with this report.");
            return null;
        }
    }
    return null;
  } catch (error) {
    throw handleFirestoreError(error, 'getting single inspection report');
  }
}

export async function deleteInspectionReport(reportId: string, userId: string): Promise<void> {
  try {
    const reportDocRef = doc(db, "inspections", reportId);
    const reportSnap = await getDoc(reportDocRef);

    if (reportSnap.exists()) {
        const reportData = reportSnap.data() as InspectionReport;
        const home = await getHome(reportData.houseId); 
        if (home && home.ownerId === userId) {
            // The associated link is now handled by the UI component (e.g., to reactivate it)
            // This function is now only responsible for deleting the report document itself.
            await deleteDoc(reportDocRef);
        } else {
            throw new Error("Permission denied to delete this inspection report.");
        }
    } else {
        throw new Error("Inspection report not found.");
    }
  } catch (error) {
    throw handleFirestoreError(error, 'deleting inspection report');
  }
}

export async function deleteAllInspectionReportsForHome(homeId: string, userId: string): Promise<void> {
  try {
    const home = await getHome(homeId);
    if (!home || home.ownerId !== userId) {
        throw new Error("Permission denied or home not found.");
    }

    const reportsCollectionRef = collection(db, "inspections");
    const q = query(reportsCollectionRef, where("houseId", "==", homeId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        // Nothing to delete
        return;
    }

    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
  } catch (error) {
    throw handleFirestoreError(error, 'deleting all reports for home');
  }
}


// URL Shortener
// Function to generate a random string
const generateShortCode = (length = 6): string => {
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

// New function to create a short link
export async function createShortLink(longUrl: string): Promise<string> {
    try {
        const shortLinksCollectionRef = collection(db, "shortLinks");
        let shortCode = '';
        let isUnique = false;

        // Loop to ensure the generated code is unique
        while (!isUnique) {
            shortCode = generateShortCode();
            const shortLinkDocRef = doc(shortLinksCollectionRef, shortCode);
            const docSnap = await getDoc(shortLinkDocRef);
            if (!docSnap.exists()) {
                isUnique = true;
            }
        }

        const shortLinkDocRef = doc(shortLinksCollectionRef, shortCode);
        await setDoc(shortLinkDocRef, {
            longUrl: longUrl,
            createdAt: serverTimestamp(),
        });

        return shortCode;
    } catch (error) {
        throw handleFirestoreError(error, 'creating short link');
    }
}

// New function to get the long URL from a short code
export async function getShortLink(shortCode: string): Promise<string | null> {
    try {
        const shortLinkDocRef = doc(db, "shortLinks", shortCode);
        const docSnap = await getDoc(shortLinkDocRef);
        if (docSnap.exists()) {
            return docSnap.data().longUrl as string;
        }
        return null;
    } catch (error) {
        throw handleFirestoreError(error, 'getting short link');
    }
}
