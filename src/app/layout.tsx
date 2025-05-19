
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google"; 
import "./globals.css";
import { Providers } from "@/components/Providers";
import { GlobalLoader } from "@/components/layout/GlobalLoader"; // Import GlobalLoader
import { AppRouterEvents } from "@/components/layout/AppRouterEvents"; // Import AppRouterEvents

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ARC Stay - Your Home, Analyzed",
  description: "Upload room photos and get AI-powered object descriptions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <AppRouterEvents /> {/* Component to handle router events for loader */}
          <GlobalLoader /> {/* Render the loader globally */}
          {children}
        </Providers>
      </body>
    </html>
  );
}
