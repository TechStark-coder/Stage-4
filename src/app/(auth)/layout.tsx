
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Aperture } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-3xl font-bold text-primary">
            <Aperture className="h-8 w-8" />
            HomeLens
          </Link>
          <p className="mt-2 text-muted-foreground">
            Your Home, Analyzed.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-lg sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
