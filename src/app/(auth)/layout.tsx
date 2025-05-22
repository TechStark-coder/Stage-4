
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 mb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-3xl font-bold text-primary">
          <Image
            src="/logo-arc-stay.png" 
            alt="ARC Stay Logo"
            width={40} 
            height={40} 
            className="h-10 w-10" 
          />
          ARC Stay
        </Link>
        <p className="text-muted-foreground">
          Your Home, Analyzed.
        </p>
      </div>
      {children}
    </div>
  );
}
