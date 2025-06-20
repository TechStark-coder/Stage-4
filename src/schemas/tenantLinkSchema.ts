
import { z } from "zod";

export const generateTenantLinkSchema = z.object({
  tenantName: z.string().min(1, { message: "Tenant name is required" }).max(100, { message: "Tenant name must be 100 characters or less" }),
});

export type GenerateTenantLinkFormData = z.infer<typeof generateTenantLinkSchema>;
