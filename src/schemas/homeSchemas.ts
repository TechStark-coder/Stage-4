
import { z } from "zod";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export const homeFormSchema = z.object({
  name: z.string().min(1, { message: "Home name is required" }).max(50, { message: "Home name must be 50 characters or less" }),
  ownerDisplayName: z.string().min(1, { message: "Your name is required" }).max(50, { message: "Name must be 50 characters or less" }).optional(),
  description: z
    .string()
    .max(250, { message: "Description must be 250 characters or less" })
    .optional()
    .nullable(), // Allow null to clear it
  coverImage: z
    .custom<FileList>()
    .refine((files) => files === null || files === undefined || files.length === 0 || (files.length === 1 && files[0].size <= MAX_FILE_SIZE), {
      message: `Max image size is 5MB.`,
    })
    .refine(
      (files) => files === null || files === undefined || files.length === 0 || (files.length === 1 && ACCEPTED_IMAGE_TYPES.includes(files[0].type)),
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    )
    .nullable()
    .optional(),
});
export type HomeFormData = z.infer<typeof homeFormSchema>;
