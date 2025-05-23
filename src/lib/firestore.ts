
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
} from "firebase/firestore";
import { db, storage } from "@/config/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import type { Home, Room, CreateHomeData, CreateRoomData, UpdateHomeData, UpdateRoomData } from "@/types";

// Helper function to safely delete from Firebase Storage
const safeDeleteStorageObject = async (filePath: string) => {
  if (!filePath) return;
  try {
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
    console.log("Successfully deleted from Firebase Storage:", filePath);
  } catch (error: any) {
    // "object-not-found" is common if trying to delete something already gone, can be ignored.
    if (error.code !== 'storage/object-not-found') {
      console.error("Error deleting object from Firebase Storage:", filePath, error);
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
    const imagePath = `homeCovers/${userId}/${newHomeRef.id}/${coverImageFile.name}`;
    const imageStorageRef = ref(storage, imagePath);
    await uploadBytes(imageStorageRef, coverImageFile);
    coverImageUrl = await getDownloadURL(imageStorageRef);
  }

  await setDoc(newHomeRef, {
    name: data.name,
    ownerId: userId,
    createdAt: serverTimestamp(),
    ...(coverImageUrl && { coverImageUrl }),
  });
  return newHomeRef.id;
}

export async function updateHome(
  homeId: string,
  userId: string, // Needed for storage path if image changes
  data: UpdateHomeData,
  newCoverImageFile?: File | null,
  removeCoverImageFlag?: boolean
): Promise<void> {
  const homeDocRef = doc(db, "homes", homeId);
  const homeSnap = await getDoc(homeDocRef);
  if (!homeSnap.exists()) throw new Error("Home not found for update");
  const currentHomeData = homeSnap.data() as Home;

  const updateData: Partial<Home> = {};
  if (data.name) {
    updateData.name = data.name;
  }

  if (removeCoverImageFlag && currentHomeData.coverImageUrl) {
    await safeDeleteStorageObject(currentHomeData.coverImageUrl); // Assuming coverImageUrl is the full path or a parsable URL
    updateData.coverImageUrl = undefined; // Or use deleteField() if you want to remove the field
  } else if (newCoverImageFile && userId) {
    // Delete old image if it exists
    if (currentHomeData.coverImageUrl) {
      await safeDeleteStorageObject(currentHomeData.coverImageUrl);
    }
    // Upload new image
    const imagePath = `homeCovers/${userId}/${homeId}/${newCoverImageFile.name}`;
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
      await updateDoc(homeDocRef, { coverImageUrl: undefined }); // Or deleteField()
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
  if (homeSnap.exists()) {
    const homeData = homeSnap.data() as Home;
    if (homeData.coverImageUrl) {
      await safeDeleteStorageObject(homeData.coverImageUrl);
    }
  }

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
    analyzedPhotoUrls: [],
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
