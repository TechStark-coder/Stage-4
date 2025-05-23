
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 mb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-3xl font-bold text-primary">
          <Image 
            src="/homiestan-logo.png" 
            alt="HomieStan Logo" 
            width={180} 
            height={45}  
            className="h-auto" 
            priority
          />
        </Link>
        <p className="text-muted-foreground">
          Your Home, Analyzed.
        </p>
      </div>
      <div className="auth-card-yashasvi-wrapper"> 
        {children}
      </div>
    </div>
  );
}
