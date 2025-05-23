
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
  deleteField, // Import deleteField
} from "firebase/firestore";
import { db, storage } from "@/config/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import type { Home, Room, CreateHomeData, CreateRoomData, UpdateHomeData, UpdateRoomData } from "@/types";

// Helper function to safely delete from Firebase Storage, handling full URLs
const safeDeleteStorageObject = async (fileUrlOrPath: string) => {
  if (!fileUrlOrPath) return;
  let storageRefPath: string;

  if (fileUrlOrPath.startsWith('gs://') || !fileUrlOrPath.includes('firebasestorage.googleapis.com')) {
    // Assume it's already a gs:// path or a direct path
    storageRefPath = fileUrlOrPath;
  } else {
    // It's an HTTPS URL, extract the path
    try {
      const url = new URL(fileUrlOrPath);
      // Path is usually after /o/ and before ?alt=media
      const pathWithBucket = url.pathname.substring(url.pathname.indexOf('/o/') + 3);
      storageRefPath = decodeURIComponent(pathWithBucket.split('?')[0]);
    } catch (error) {
      console.error("Invalid URL, cannot extract path for deletion:", fileUrlOrPath, error);
      return;
    }
  }

  try {
    const storageRef = ref(storage, storageRefPath);
    await deleteObject(storageRef);
    console.log("Successfully deleted from Firebase Storage:", storageRefPath);
  } catch (error: any) {
    if (error.code !== 'storage/object-not-found') {
      console.error("Error deleting object from Firebase Storage:", storageRefPath, error);
    } else {
      console.log("Object not found in Firebase Storage (already deleted?):", storageRefPath);
    }
  }
};

// Homes
export async function addHome(
  userId: string,
  data: CreateHomeData,
  coverImageFile?: File | null
): Promise<string> {
  const homesCollectionRef = collection(db, "homes");
  const newHomeRef = doc(homesCollectionRef); // Generate ID upfront

  let coverImageUrl: string | undefined = undefined;
  if (coverImageFile && userId) {
    const imagePath = `homeCovers/${userId}/${newHomeRef.id}/${Date.now()}_${coverImageFile.name}`;
    const imageStorageRef = ref(storage, imagePath);
    await uploadBytes(imageStorageRef, coverImageFile);
    coverImageUrl = await getDownloadURL(imageStorageRef);
  }

  await setDoc(newHomeRef, {
    name: data.name,
    description: data.description || "", // Save description
    ownerId: userId,
    createdAt: serverTimestamp(),
    ...(coverImageUrl && { coverImageUrl }),
  });
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
  if (!homeSnap.exists()) throw new Error("Home not found for update");
  const currentHomeData = homeSnap.data() as Home;

  const updateData: any = {}; // Use any to allow deleteField
  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.description !== undefined) {
    updateData.description = data.description === null ? deleteField() : data.description;
  } else if (data.description === null) { // Explicitly clear if null
    updateData.description = deleteField();
  }


  if (newCoverImageFile && userId) {
    if (currentHomeData.coverImageUrl) {
      await safeDeleteStorageObject(currentHomeData.coverImageUrl);
    }
    const imagePath = `homeCovers/${userId}/${homeId}/${Date.now()}_${newCoverImageFile.name}`;
    const imageStorageRef = ref(storage, imagePath);
    await uploadBytes(imageStorageRef, newCoverImageFile);
    updateData.coverImageUrl = await getDownloadURL(imageStorageRef);
  }
  
  if (Object.keys(updateData).length > 0) {
    await updateDoc(homeDocRef, updateData);
  }
}

export async function removeHomeCoverImage(homeId: string): Promise<void> {
  const homeDocRef = doc(db, "homes", homeId);
  const homeSnap = await getDoc(homeDocRef);
  if (homeSnap.exists()) {
    const homeData = homeSnap.data() as Home;
    if (homeData.coverImageUrl) {
      await safeDeleteStorageObject(homeData.coverImageUrl);
      await updateDoc(homeDocRef, { coverImageUrl: deleteField() });
    }
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

export async function deleteHome(homeId: string): Promise<void> {
  const homeDocRef = doc(db, "homes", homeId);
  const homeSnap = await getDoc(homeDocRef);

  // Delete associated images from Firebase Storage
  if (homeSnap.exists()) {
    const homeData = homeSnap.data() as Home;
    if (homeData.coverImageUrl) {
      await safeDeleteStorageObject(homeData.coverImageUrl);
    }
  }

  // Delete rooms and their associated images
  const roomsCollectionRef = collection(db, `homes/${homeId}/rooms`);
  const roomsSnapshot = await getDocs(roomsCollectionRef);
  const batch = writeBatch(db);
  for (const roomDoc of roomsSnapshot.docs) {
    const roomData = roomDoc.data() as Room;
    if (roomData.analyzedPhotoUrls && roomData.analyzedPhotoUrls.length > 0) {
      for (const url of roomData.analyzedPhotoUrls) {
        await safeDeleteStorageObject(url);
      }
    }
    batch.delete(roomDoc.ref);
  }
  await batch.commit();

  // Delete the home document itself
  await deleteDoc(homeDocRef);
}

// Rooms
export async function addRoom(homeId: string, data: CreateRoomData): Promise<string> {
  const roomsCollectionRef = collection(db, "homes", homeId, "rooms");
  const docRef = await addDoc(roomsCollectionRef, {
    ...data,
    createdAt: serverTimestamp(),
    objectNames: null,
    isAnalyzing: false,
    lastAnalyzedAt: null,
    analyzedPhotoUrls: [], // Initialize as empty array
  });
  return docRef.id;
}

export async function updateRoom(homeId: string, roomId: string, data: UpdateRoomData): Promise<void> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
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
  objectNames: string[],
  analyzedPhotoUrls: string[]
): Promise<void> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
  await updateDoc(roomDocRef, {
    objectNames: objectNames,
    isAnalyzing: false,
    lastAnalyzedAt: serverTimestamp(),
    analyzedPhotoUrls: analyzedPhotoUrls,
  });
}

export async function clearRoomAnalysisData(homeId: string, roomId: string): Promise<void> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
  const roomSnap = await getDoc(roomDocRef);
  if (roomSnap.exists()) {
    const roomData = roomSnap.data() as Room;
    if (roomData.analyzedPhotoUrls && roomData.analyzedPhotoUrls.length > 0) {
      for (const url of roomData.analyzedPhotoUrls) {
        await safeDeleteStorageObject(url);
      }
    }
  }
  await updateDoc(roomDocRef, {
    objectNames: null,
    isAnalyzing: false,
    lastAnalyzedAt: null,
    analyzedPhotoUrls: [], // Clear the array
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

export async function deleteRoom(homeId: string, roomId: string): Promise<void> {
  const roomDocRef = doc(db, `homes/${homeId}/rooms`, roomId);
  const roomSnap = await getDoc(roomDocRef);
  if (roomSnap.exists()) {
    const roomData = roomSnap.data() as Room;
    if (roomData.analyzedPhotoUrls && roomData.analyzedPhotoUrls.length > 0) {
      for (const url of roomData.analyzedPhotoUrls) {
        await safeDeleteStorageObject(url);
      }
    }
  }
  await deleteDoc(roomDocRef);
}
