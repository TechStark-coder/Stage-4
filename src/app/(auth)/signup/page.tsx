
import { NewCustomSignupForm } from "@/components/auth/NewCustomSignupForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up - HomieStan",
};

export default function SignupPage() {
  return <NewCustomSignupForm />;
}

