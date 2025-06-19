
import { z } from "zod";

export const generateTenantLinkSchema = z.object({
  tenantName: z.string().min(1, { message: "Tenant name is required" }).max(100, { message: "Tenant name must be 100 characters or less" }),
  validityDurationDays: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().int().positive({ message: "Validity must be a positive number of days" }).optional().nullable()
  ),
});

export type GenerateTenantLinkFormData = z.infer<typeof generateTenantLinkSchema>;
