
import { SignupForm } from "@/components/auth/SignupForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up - ARC Stay",
};

export default function SignupPage() {
  return <SignupForm />;
}
