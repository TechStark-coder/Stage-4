
import type { Auth, User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile, 
} from "firebase/auth";
import type { LoginFormData, SignupFormData } from "@/schemas/authSchemas";

export async function signUpWithEmail(auth: Auth, data: SignupFormData): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
  
  // After creating the user, update their profile with the display name
  // This ensures user.displayName is available on the auth object relatively quickly
  await updateProfile(userCredential.user, {
    displayName: data.displayName,
  });

  // The user object in userCredential might not immediately reflect the displayName update.
  // However, onAuthStateChanged listeners will receive the updated user object.
  // For immediate use post-signup, returning userCredential.user is standard, and
  // Firestore document for the user can also use data.displayName as a reliable source.
  return userCredential.user;
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
