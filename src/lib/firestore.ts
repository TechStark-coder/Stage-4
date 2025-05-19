
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
} from "firebase/firestore";
import { db, storage } from "@/config/firebase"; // Import storage
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import type { Home, Room, CreateHomeData, CreateRoomData } from "@/types";

// Homes
export async function addHome(userId: string, data: CreateHomeData): Promise<string> {
  const homesCollectionRef = collection(db, "homes");
  let coverImageUrl: string | undefined = undefined;

  const newHomeRef = doc(homesCollectionRef); // Generate ID upfront for storage path

  if (data.coverImage && data.coverImage instanceof File) {
    const imageFile = data.coverImage;
    const storageRef = ref(
      storage,
      `homeCovers/${userId}/${newHomeRef.id}/${imageFile.name}`
    );
    await uploadBytes(storageRef, imageFile);
    coverImageUrl = await getDownloadURL(storageRef);
  }

  await setDoc(newHomeRef, { // Use setDoc with the generated ref
    name: data.name,
    ownerId: userId,
    createdAt: serverTimestamp(),
    ...(coverImageUrl && { coverImageUrl }), // Conditionally add coverImageUrl
  });
  return newHomeRef.id;
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
  const homeDoc = await getDoc(homeDocRef);

  if (homeDoc.exists()) {
    const homeData = homeDoc.data() as Home;
    // Delete cover image from storage if it exists
    if (homeData.coverImageUrl) {
      try {
        const imageRef = ref(storage, homeData.coverImageUrl);
        await deleteObject(imageRef);
      } catch (error) {
        console.error("Error deleting cover image from storage:", error);
        // Optionally, decide if you want to proceed with deleting Firestore doc even if image deletion fails
      }
    }
  }

  // Delete rooms subcollection
  const roomsCollectionRef = collection(db, `homes/${homeId}/rooms`);
  const roomsSnapshot = await getDocs(roomsCollectionRef);
  
  const batch = writeBatch(db);
  roomsSnapshot.docs.forEach(roomDoc => {
    batch.delete(roomDoc.ref);
  });
  await batch.commit();
  
  // Delete the home document
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
  });
  return docRef.id;
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

export async function updateRoomObjectNames(
  homeId: string,
  roomId: string,
  names: string[]
): Promise<void> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
  await updateDoc(roomDocRef, {
    objectNames: names,
    isAnalyzing: false,
    lastAnalyzedAt: serverTimestamp(),
  });
}

export async function clearRoomObjectNames(homeId: string, roomId: string): Promise<void> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
  await updateDoc(roomDocRef, {
    objectNames: null,
    isAnalyzing: false, 
    lastAnalyzedAt: null,
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
  await deleteDoc(doc(db, `homes/${homeId}/rooms`, roomId));
}
// Need to import setDoc
import { setDoc } from "firebase/firestore";
