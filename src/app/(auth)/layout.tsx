
import type { ReactNode } from "react";
// import Image from "next/image"; // No longer using next/image for the logo here
import Link from "next/link";

const ArcStayLogo = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-10 w-10 text-primary"
  >
    <path
      d="M50 15L15 85H30L50 45L70 85H85L50 15Z"
      stroke="currentColor"
      strokeWidth="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M38 60H62"
      stroke="currentColor"
      strokeWidth="10"
      strokeLinecap="round"
    />
  </svg>
);

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 mb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-3xl font-bold text-primary">
          <ArcStayLogo />
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
