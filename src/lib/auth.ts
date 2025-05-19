
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
  // This ensures user.displayName is available on the auth object
  await updateProfile(userCredential.user, {
    displayName: data.displayName,
  });

  // The user object in userCredential might not immediately reflect the displayName update.
  // However, onAuthStateChanged listeners will receive the updated user object.
  // For immediate use, re-fetch or use the user object from auth.currentUser after a short delay if needed,
  // but for this flow, returning userCredential.user is standard. AuthProvider will pick up the change.
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
