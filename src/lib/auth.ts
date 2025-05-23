
import type { Auth, User, UserCredential } from "firebase/auth"; // Added UserCredential
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile, 
} from "firebase/auth";
import type { LoginFormData, SignupFormData } from "@/schemas/authSchemas";

export async function signUpWithEmail(auth: Auth, data: SignupFormData): Promise<UserCredential> { // Return UserCredential
  const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
  
  // After creating the user, update their profile with the display name
  // This ensures user.displayName is available on the auth object relatively quickly
  // and is important for creating the Firestore user document immediately after.
  if (userCredential.user) {
    await updateProfile(userCredential.user, {
      displayName: data.displayName,
    });
  } else {
    // This case should ideally not happen if createUserWithEmailAndPassword succeeds
    throw new Error("User object not available after account creation.");
  }
  
  return userCredential; // Return the full credential
}

export async function signInWithEmail(auth: Auth, data: LoginFormData): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
  return userCredential.user;
}

export async function signOut(auth: Auth): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthStateChangedHelper(
  auth: Auth,
  callback: (user: User | null) => void
) {
  return onAuthStateChanged(auth, callback);
}

    