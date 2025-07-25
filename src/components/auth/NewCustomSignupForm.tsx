
"use client";

import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation"; 
import { Eye, EyeOff } from "lucide-react"; 
import * as _React from "react"; 

import { signupSchema, type SignupFormData } from "@/schemas/authSchemas";
import { signUpWithEmail } from "@/lib/auth";
import { auth, db } from "@/config/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useLoader } from "@/contexts/LoaderContext";

export function NewCustomSignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoader();
  const [showPassword, setShowPassword] = _React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = _React.useState(false);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const sendWelcomeEmail = async (email: string, displayName: string) => {
    try {
      const response = await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.warn("Failed to send welcome email:", errorData.message);
        // Optionally, show a non-critical toast to the user or admin
        // toast({ title: "Info", description: "Welcome email could not be sent.", variant: "default" });
      } else {
        console.log("Welcome email initiated successfully.");
      }
    } catch (error) {
      console.warn("Error calling send-welcome-email API:", error);
    }
  };

  const onSubmit: SubmitHandler<SignupFormData> = async (data) => {
    showLoader();
    try {
      const userCredential = await signUpWithEmail(auth, data);
      if (!userCredential || !userCredential.user) {
        throw new Error("User creation failed or user object not returned.");
      }
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: data.displayName,
        email: data.email, 
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Signup Successful",
        description: "Your account has been created. Redirecting...",
      });
      sessionStorage.setItem("showWelcomeOnLoad", "true");
      sessionStorage.setItem("lastAuthAction", "signup");
      
      // Send welcome email (fire and forget, don't block UI)
      sendWelcomeEmail(data.email, data.displayName);

      router.push("/dashboard");
      // hideLoader() handled by AppRouterEvents
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Signup Failed",
        description: error.message || "An unexpected error occurred during signup.",
        variant: "destructive",
      });
      hideLoader();
    }
  };

  return (
    <div className="auth-card-yashasvi">
        <form className="auth-form-yashasvi" onSubmit={form.handleSubmit(onSubmit)}>
        <p className="auth-heading-yashasvi">Sign Up</p>
        
        <div className="auth-field-yashasvi">
            <svg viewBox="0 0 24 24" fill="currentColor" height="16" width="16" xmlns="http://www.w3.org/2000/svg" className="auth-input-icon-yashasvi">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path>
            </svg>
            <input
            type="text"
            className="auth-input-field-yashasvi"
            placeholder="Full Name (Firstname)"
            autoComplete="name"
            {...form.register("displayName")}
            />
        </div>
        {form.formState.errors.displayName && (
            <p className="auth-error-message">{form.formState.errors.displayName.message}</p>
        )}

        <div className="auth-field-yashasvi">
            <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            height="16"
            width="16"
            xmlns="http://www.w3.org/2000/svg"
            className="auth-input-icon-yashasvi"
            >
            <path
                d="M13.106 7.222c0-2.967-2.249-5.032-5.482-5.032-3.35 0-5.646 2.318-5.646 5.702 0 3.493 2.235 5.708 5.762 5.708.862 0 1.689-.123 2.304-.335v-.862c-.43.199-1.354.328-2.29.328-2.926 0-4.813-1.88-4.813-4.798 0-2.844 1.921-4.881 4.594-4.881 2.735 0 4.608 1.688 4.608 4.156 0 1.682-.554 2.769-1.416 2.769-.492 0-.772-.28-.772-.76V5.206H8.923v.834h-.11c-.266-.595-.881-.964-1.6-.964-1.4 0-2.378 1.162-2.378 2.823 0 1.737.957 2.906 2.379 2.906.8 0 1.415-.39 1.709-1.087h.11c.081.67.703 1.148 1.503 1.148 1.572 0 2.57-1.415 2.57-3.643zm-7.177.704c0-1.197.54-1.907 1.456-1.907.93 0 1.524.738 1.524 1.907S8.308 9.84 7.371 9.84c-.895 0-1.442-.725-1.442-1.914z"
            ></path>
            </svg>
            <input
            type="email"
            className="auth-input-field-yashasvi"
            placeholder="Email (Username)"
            autoComplete="email"
            {...form.register("email")}
            />
        </div>
        {form.formState.errors.email && (
            <p className="auth-error-message">{form.formState.errors.email.message}</p>
        )}

        <div className="auth-field-yashasvi relative">
            <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            height="16"
            width="16"
            xmlns="http://www.w3.org/2000/svg"
            className="auth-input-icon-yashasvi"
            >
            <path
                d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"
            ></path>
            </svg>
            <input
            type={showPassword ? "text" : "password"}
            className="auth-input-field-yashasvi"
            placeholder="Password"
            {...form.register("password")}
            />
            <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
            aria-label={showPassword ? "Hide password" : "Show password"}
            >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
        {form.formState.errors.password && (
            <p className="auth-error-message">{form.formState.errors.password.message}</p>
        )}

        <div className="auth-field-yashasvi relative">
            <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            height="16"
            width="16"
            xmlns="http://www.w3.org/2000/svg"
            className="auth-input-icon-yashasvi"
            >
            <path
                d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"
            ></path>
            </svg>
            <input
            type={showConfirmPassword ? "text" : "password"}
            className="auth-input-field-yashasvi"
            placeholder="Confirm Password"
            {...form.register("confirmPassword")}
            />
            <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
        {form.formState.errors.confirmPassword && (
            <p className="auth-error-message">{form.formState.errors.confirmPassword.message}</p>
        )}

        <div className="auth-buttons-yashasvi">
            <button type="submit" className="auth-button-yashasvi" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Signing up..." : "Sign Up"}
            </button>
            <Link href="/login" passHref>
            <button type="button" className="auth-button-yashasvi signup-link">Sign In</button>
            </Link>
        </div>
        </form>
    </div>
  );
}
