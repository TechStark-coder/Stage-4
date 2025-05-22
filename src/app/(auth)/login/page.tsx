
// import { LoginForm } from "@/components/auth/LoginForm"; // Old form
import { CombinedAuthForm } from "@/components/auth/CombinedAuthForm"; // New form
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login - ARC Stay",
};

export default function LoginPage() {
  // return <LoginForm />; // Old
  return <CombinedAuthForm initialMode="login" />; // New
}
