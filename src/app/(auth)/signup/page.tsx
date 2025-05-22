
// import { SignupForm } from "@/components/auth/SignupForm"; // Old form
import { CombinedAuthForm } from "@/components/auth/CombinedAuthForm"; // New form
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up - ARC Stay",
};

export default function SignupPage() {
  // return <SignupForm />; // Old
  return <CombinedAuthForm initialMode="signup" />; // New
}
