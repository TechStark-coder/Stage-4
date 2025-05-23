
"use client";

// This component is no longer actively used by the main login/signup pages
// It is replaced by NewCustomLoginForm.tsx and NewCustomSignupForm.tsx
// Keeping the file for reference or potential future use if the flipping design is revisited.

import { useState, type ChangeEvent, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { loginSchema, type LoginFormData, signupSchema, type SignupFormData } from "@/schemas/authSchemas";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth";
import { auth, db } from "@/config/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useLoader } from "@/contexts/LoaderContext";

interface CombinedAuthFormProps {
  initialMode?: "login" | "signup";
}

export function CombinedAuthForm({ initialMode = "login" }: CombinedAuthFormProps) {
  const [isSignup, setIsSignup] = useState(initialMode === "signup");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const router = useRouter();
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoader();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { displayName: "", email: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    setIsSignup(initialMode === "signup");
    // Reset forms when mode changes via prop, ensuring correct form state
    if (initialMode === "signup") {
      loginForm.reset();
    } else {
      signupForm.reset();
    }
  }, [initialMode, loginForm, signupForm]);


  const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const newIsSignup = event.target.checked;
    setIsSignup(newIsSignup);
    // Reset the form that is being hidden
    if (newIsSignup) { 
      loginForm.reset();
    } else { 
      signupForm.reset();
    }
  };

  const onSubmitLogin: SubmitHandler<LoginFormData> = async (data) => {
    showLoader();
    try {
      await signInWithEmail(auth, data);
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Login error:", error);
      const invalidCredentialCodes = ["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password", "auth/invalid-email"];
      if (invalidCredentialCodes.includes(error.code) || error.message.includes("invalid-credential")) {
        toast({
          title: "Login Failed",
          description: "Invalid email or password. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Login Failed",
          description: error.message || "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
      hideLoader(); 
    }
  };

  const onSubmitSignup: SubmitHandler<SignupFormData> = async (data) => {
    showLoader();
    try {
      const userCredential = await signUpWithEmail(auth, data);
      
      if (!userCredential || !userCredential.user) {
        throw new Error("User creation failed or user object not returned.");
      }
      const user = userCredential.user;

      // Firestore document creation
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: data.displayName, 
        email: data.email,
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Signup Successful",
        description: "Your account has been created. Welcome!",
      });
      router.push("/dashboard");
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
    <div className="auth-container"> {/* This class and its CSS should be removed from globals.css if not used */}
      <input type="checkbox" id="signup_toggle" checked={isSignup} onChange={handleToggle} />
      <form className="auth-form"> {/* Styles for .auth-form, .form_front, .form_back should be removed from globals.css */}
        {/* Login Form Part */}
        <div className="form_front">
          <div className="auth-form_details">Login</div>
          <div className="w-full">
            <input
              placeholder="Email"
              className="auth-input"
              type="email"
              {...loginForm.register("email")}
            />
            {loginForm.formState.errors.email && (
              <p className="text-xs text-destructive mt-1">{loginForm.formState.errors.email.message}</p>
            )}
          </div>
          <div className="w-full relative">
            <input
              placeholder="Password"
              className="auth-input"
              type={showLoginPassword ? "text" : "password"}
              {...loginForm.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowLoginPassword(!showLoginPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showLoginPassword ? "Hide password" : "Show password"}
            >
              {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            {loginForm.formState.errors.password && (
              <p className="text-xs text-destructive mt-1">{loginForm.formState.errors.password.message}</p>
            )}
          </div>
          <button 
            className="auth-btn" 
            type="button" 
            onClick={loginForm.handleSubmit(onSubmitLogin)} 
            disabled={loginForm.formState.isSubmitting || loginForm.formState.isLoading}
          >
            {loginForm.formState.isSubmitting ? "Logging in..." : "Login"}
          </button>
          <span className="auth-switch">
            Don&apos;t have an account?{" "}
            <label className="auth-signup_tog" htmlFor="signup_toggle">
              Sign Up
            </label>
          </span>
        </div>

        {/* Signup Form Part */}
        <div className="form_back">
          <div className="auth-form_details">Sign Up</div>
          <div className="w-full">
            <input
              placeholder="Full Name"
              className="auth-input"
              type="text"
              {...signupForm.register("displayName")}
            />
            {signupForm.formState.errors.displayName && (
              <p className="text-xs text-destructive mt-1">{signupForm.formState.errors.displayName.message}</p>
            )}
          </div>
          <div className="w-full">
            <input
              placeholder="Email"
              className="auth-input"
              type="email"
              {...signupForm.register("email")}
            />
            {signupForm.formState.errors.email && (
              <p className="text-xs text-destructive mt-1">{signupForm.formState.errors.email.message}</p>
            )}
          </div>
          <div className="w-full relative">
            <input
              placeholder="Password"
              className="auth-input"
              type={showSignupPassword ? "text" : "password"}
              {...signupForm.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowSignupPassword(!showSignupPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showSignupPassword ? "Hide password" : "Show password"}
            >
              {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            {signupForm.formState.errors.password && (
              <p className="text-xs text-destructive mt-1">{signupForm.formState.errors.password.message}</p>
            )}
          </div>
          <div className="w-full relative">
            <input
              placeholder="Confirm Password"
              className="auth-input"
              type={showConfirmPassword ? "text" : "password"}
              {...signupForm.register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            {signupForm.formState.errors.confirmPassword && (
              <p className="text-xs text-destructive mt-1">{signupForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>
          <button 
            className="auth-btn" 
            type="button"
            onClick={signupForm.handleSubmit(onSubmitSignup)} 
            disabled={signupForm.formState.isSubmitting || signupForm.formState.isLoading}
          >
            {signupForm.formState.isSubmitting ? "Signing up..." : "Sign Up"}
          </button>
          <span className="auth-switch">
            Already have an account?{" "}
            <label className="auth-signup_tog" htmlFor="signup_toggle">
              Sign In
            </label>
          </span>
        </div>
      </form>
    </div>
  );
}

    