
import type { Metadata } from "next";
import { Geist_Sans as Geist, Geist_Mono } from "next/font/google"; 
import "./globals.css";
import { Providers } from "@/components/Providers";
import { GlobalLoader } from "@/components/layout/GlobalLoader";
import { AppRouterEvents } from "@/components/layout/AppRouterEvents";
import { GlobalAiAnalysisLoader } from "@/components/layout/GlobalAiAnalysisLoader"; // Ensure this import is correct


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HomieStan - Your Home, Analyzed",
  description: "Upload room photos and get AI-powered object descriptions with HomieStan.",
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
          <AppRouterEvents /> 
          <GlobalLoader /> 
          <GlobalAiAnalysisLoader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
