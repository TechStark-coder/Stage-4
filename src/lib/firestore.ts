
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
  setDoc, // Ensure setDoc is imported
} from "firebase/firestore";
import { db } from "@/config/firebase"; // Removed storage import as it's not used here for home covers
import type { Home, Room, CreateHomeData, CreateRoomData, UpdateHomeData, UpdateRoomData } from "@/types";

// Homes
export async function addHome(userId: string, data: CreateHomeData): Promise<string> {
  const homesCollectionRef = collection(db, "homes");
  const newHomeRef = doc(homesCollectionRef); // Generate ID upfront

  // No cover image upload to Firebase Storage here
  await setDoc(newHomeRef, {
    name: data.name,
    ownerId: userId,
    createdAt: serverTimestamp(),
  });
  return newHomeRef.id;
}

export async function updateHome(homeId: string, data: UpdateHomeData): Promise<void> {
  const homeDocRef = doc(db, "homes", homeId);
  const updateData: Partial<Home> = {};
  if (data.name) {
    updateData.name = data.name;
  }
  // No cover image handling for Firebase Storage here
  await updateDoc(homeDocRef, updateData);
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
  // No cover image deletion from Firebase Storage here

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
