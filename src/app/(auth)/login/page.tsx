
import { NewCustomLoginForm } from "@/components/auth/NewCustomLoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login - HomieStan",
};

export default function LoginPage() {
  return <NewCustomLoginForm />;
}

