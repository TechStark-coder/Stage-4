
// src/components/auth/CombinedAuthForm.tsx
"use client";

import { useState, type ChangeEvent, useEffect } from "react"; // Added useEffect
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react"; // Removed LogIn, UserPlus as they are not used in this custom form

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

  // Sync the visual toggle with the initialMode prop
  useEffect(() => {
    setIsSignup(initialMode === "signup");
  }, [initialMode]);


  const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    setIsSignup(event.target.checked);
     // Reset forms when toggling to clear previous errors/values
    if (event.target.checked) { // Toggled to signup
      loginForm.reset();
    } else { // Toggled to login
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
      // hideLoader() will be handled by AppRouterEvents on successful navigation
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
      hideLoader(); // Hide loader only if login fails
    }
  };

  const onSubmitSignup: SubmitHandler<SignupFormData> = async (data) => {
    showLoader();
    try {
      const userCredential = await signUpWithEmail(auth, data);
      // Ensure user object is available for displayName update
      if (userCredential && auth.currentUser) {
        // The signUpWithEmail function in lib/auth.ts already handles updateProfile
        // We just need to ensure the user document in Firestore is created
         await setDoc(doc(db, "users", userCredential.uid), {
          uid: userCredential.uid,
          displayName: data.displayName, // Use displayName from form data
          email: data.email,
          createdAt: serverTimestamp(),
        });
      } else {
        throw new Error("User creation failed or user not available immediately after signup.");
      }
      toast({
        title: "Signup Successful",
        description: "Your account has been created. Welcome!",
      });
      router.push("/dashboard");
      // hideLoader() will be handled by AppRouterEvents on successful navigation
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Signup Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
      hideLoader(); // Hide loader only if signup fails
    }
  };

  return (
    <div className="auth-container">
      <input type="checkbox" id="signup_toggle" checked={isSignup} onChange={handleToggle} />
      <div className="auth-form">
        {/* Login Form Part */}
        <form onSubmit={loginForm.handleSubmit(onSubmitLogin)} className="form_front" noValidate>
          <div className="auth-form_details">Login</div>
          <div className="w-full">
            <input
              placeholder="Email (Username)"
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
          <button className="auth-btn" type="submit" disabled={loginForm.formState.isSubmitting}>
            {loginForm.formState.isSubmitting ? "Logging in..." : "Login"}
          </button>
          <span className="auth-switch">
            Don&apos;t have an account?{" "}
            <label className="auth-signup_tog" htmlFor="signup_toggle">
              Sign Up
            </label>
          </span>
        </form>

        {/* Signup Form Part */}
        <form onSubmit={signupForm.handleSubmit(onSubmitSignup)} className="form_back" noValidate>
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
              placeholder="Email (Username)"
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
          <button className="auth-btn" type="submit" disabled={signupForm.formState.isSubmitting}>
            {signupForm.formState.isSubmitting ? "Signing up..." : "Sign Up"}
          </button>
          <span className="auth-switch">
            Already have an account?{" "}
            <label className="auth-signup_tog" htmlFor="signup_toggle">
              Sign In
            </label>
          </span>
        </form>
      </div>
    </div>
  );
}

