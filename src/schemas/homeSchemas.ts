
import { z } from "zod";

export const createHomeSchema = z.object({
  name: z.string().min(1, { message: "Home name is required" }).max(50, { message: "Home name must be 50 characters or less" }),
});
export type CreateHomeFormData = z.infer<typeof createHomeSchema>;
