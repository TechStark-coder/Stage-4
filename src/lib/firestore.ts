
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
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { Home, Room, CreateHomeData, CreateRoomData } from "@/types";

// Homes
export async function addHome(userId: string, data: CreateHomeData): Promise<string> {
  const homesCollectionRef = collection(db, "homes");
  const docRef = await addDoc(homesCollectionRef, {
    ...data,
    ownerId: userId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
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
  // Potentially delete subcollections (rooms, photos) here too if needed
  // For now, just deleting the home document
  // Get all rooms for this home and delete them first
  const roomsSnapshot = await getDocs(collection(db, `homes/${homeId}/rooms`));
  const deleteRoomPromises = roomsSnapshot.docs.map(roomDoc => deleteDoc(roomDoc.ref));
  await Promise.all(deleteRoomPromises);
  
  await deleteDoc(doc(db, "homes", homeId));
}


// Rooms
export async function addRoom(homeId: string, data: CreateRoomData): Promise<string> {
  const roomsCollectionRef = collection(db, "homes", homeId, "rooms");
  const docRef = await addDoc(roomsCollectionRef, {
    ...data,
    createdAt: serverTimestamp(),
    objectDescription: null,
    isAnalyzing: false,
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

export async function updateRoomObjectDescription(
  homeId: string,
  roomId: string,
  description: string
): Promise<void> {
  const roomDocRef = doc(db, "homes", homeId, "rooms", roomId);
  await updateDoc(roomDocRef, {
    objectDescription: description,
    isAnalyzing: false,
    lastAnalyzedAt: serverTimestamp(),
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

