
import type { Auth, User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import type { LoginFormData } from "@/schemas/authSchemas";
import type { SignupFormData } from "@/schemas/authSchemas";

export async function signUpWithEmail(auth: Auth, data: SignupFormData): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
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
