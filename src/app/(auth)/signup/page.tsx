
import { NewCustomSignupForm } from "@/components/auth/NewCustomSignupForm"; // Use new form
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up - ARC Stay",
};

export default function SignupPage() {
  return <NewCustomSignupForm />;
}
