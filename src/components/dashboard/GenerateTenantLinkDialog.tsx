
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { addTenantInspectionLink, createShortLink } from "@/lib/firestore";
import { generateTenantLinkSchema, type GenerateTenantLinkFormData } from "@/schemas/tenantLinkSchema";
import type { Home, TenantInspectionLink } from "@/types";
import { Link2, Copy, CheckCircle, UserPlus } from "lucide-react";
import { useLoader } from "@/contexts/LoaderContext";

interface GenerateTenantLinkDialogProps {
  home: Home;
  currentUserUid: string;
  onLinkGenerated?: (link: TenantInspectionLink) => void;
  children: React.ReactNode; // For the trigger button
}

export function GenerateTenantLinkDialog({ home, currentUserUid, onLinkGenerated, children }: GenerateTenantLinkDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [generatedLink, setGeneratedLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoader();

  const form = useForm<GenerateTenantLinkFormData>({
    resolver: zodResolver(generateTenantLinkSchema),
    defaultValues: {
      tenantName: "",
    },
  });

  async function onSubmit(data: GenerateTenantLinkFormData) {
    showLoader();
    setGeneratedLink(null);
    try {
      const newLink = await addTenantInspectionLink(home.id, currentUserUid, {
        tenantName: data.tenantName,
      });
      
      const longUrl = `${window.location.origin}/inspect/${home.id}?linkId=${newLink.id}`;
      const shortCode = await createShortLink(longUrl);
      const shortUrl = `${window.location.origin}/go/${shortCode}`;

      setGeneratedLink(shortUrl);
      toast({ title: "Link Generated Successfully!", description: "The shortened inspection link is ready to be shared." });
      form.reset(); // Reset form for next time
      if (onLinkGenerated) {
        onLinkGenerated(newLink);
      }
      // Keep dialog open to show the link
    } catch (error: any) {
      console.error("Failed to generate link:", error);
      toast({ title: "Failed to Generate Link", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      hideLoader();
    }
  }

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink).then(() => {
      setCopied(true);
      toast({ title: "Link Copied!", description: "Inspection link copied to clipboard."});
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Failed to copy link:", err);
      toast({ title: "Copy Failed", description: "Could not copy link.", variant: "destructive"});
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setGeneratedLink(null); // Clear generated link when dialog closes
      form.reset(); // Reset form when dialog closes
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Generate Inspection Link
          </DialogTitle>
          <DialogDescription>
            Create a shareable link for <strong>{home.name}</strong> for a tenant to complete an inspection.
          </DialogDescription>
        </DialogHeader>
        {!generatedLink ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="tenantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant's Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter tenant's full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Generating..." : "Generate Link"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Link generated for {form.getValues("tenantName") || "tenant"}:</p>
            <div className="flex items-center space-x-2">
              <Input type="text" value={generatedLink} readOnly className="flex-1" />
              <Button type="button" size="icon" onClick={handleCopyLink} variant={copied ? "default" : "outline"}>
                {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This link is active and can be used immediately. It will be deactivated once an inspection report is submitted using it.
            </p>
            <DialogFooter className="pt-2">
               <Button type="button" variant="outline" onClick={() => { setGeneratedLink(null); form.reset(); /* Allow generating another */ }}>
                Generate New Link
              </Button>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
