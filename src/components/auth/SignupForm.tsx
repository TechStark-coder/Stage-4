
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { signUpWithEmail } from "@/lib/auth";
import { auth, db } from "@/config/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { signupSchema, type SignupFormData } from "@/schemas/authSchemas";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: SignupFormData) {
    try {
      const user = await signUpWithEmail(auth, data); 
      
      // Create a user document in Firestore
      // Use user.displayName which should be set by signUpWithEmail via updateProfile
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid, 
        displayName: user.displayName || data.displayName, // Fallback to form data if auth profile update is slow
        email: user.email,
        createdAt: serverTimestamp(),
      });
      toast({
        title: "Signup Successful",
        description: "Your account has been created.",
      });
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Signup Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Asif Khan" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          <UserPlus className="mr-2 h-4 w-4" />
          {form.formState.isSubmitting ? "Signing up..." : "Sign Up"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Login
          </Link>
        </p>
      </form>
    </Form>
  );
}
