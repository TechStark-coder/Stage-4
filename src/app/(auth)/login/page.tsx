
import { NewCustomLoginForm } from "@/components/auth/NewCustomLoginForm"; // Use new form
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login - ARC Stay",
};

export default function LoginPage() {
  return <NewCustomLoginForm />;
}
