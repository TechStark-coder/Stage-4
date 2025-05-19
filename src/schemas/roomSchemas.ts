
import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().min(1, { message: "Room name is required" }).max(50, { message: "Room name must be 50 characters or less" }),
});
export type CreateRoomFormData = z.infer<typeof createRoomSchema>;

export const photoUploadSchema = z.object({
  photos: z.custom<FileList>().refine(files => files && files.length > 0, "At least one photo is required."),
});
export type PhotoUploadFormData = z.infer<typeof photoUploadSchema>;
