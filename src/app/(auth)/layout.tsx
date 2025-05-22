
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
// import { Aperture } from "lucide-react"; // Replaced with Image

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 mb-6 text-center"> {/* Adjusted spacing */}
        <Link href="/" className="inline-flex items-center gap-2 text-3xl font-bold text-primary">
          <Image
            src="/logo-arc-stay.png" 
            alt="ARC Stay Logo"
            width={40} // Adjust as needed
            height={40} // Adjust as needed
            className="h-10 w-10" // Tailwind classes for size, can also use width/height props directly
          />
          ARC Stay
        </Link>
        <p className="text-muted-foreground">
          Your Home, Analyzed.
        </p>
      </div>
      {/* The custom form has its own card-like styling, so removing the ShadCN Card wrapper */}
      {children}
    </div>
  );
}
