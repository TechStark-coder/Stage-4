
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  displayName: z.string().min(1, { message: "Name is required" }).max(50, { message: "Name must be 50 characters or less" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"], // path of error
});
export type SignupFormData = z.infer<typeof signupSchema>;
