
import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { GlobalLoader } from "@/components/layout/GlobalLoader";
import { AppRouterEvents } from "@/components/layout/AppRouterEvents";
import { GlobalAiAnalysisLoader } from "@/components/layout/GlobalAiAnalysisLoader";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
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
        className={`${inter.variable} ${robotoMono.variable} antialiased`}
        suppressHydrationWarning={true} // Added to suppress hydration warnings
      >
        <Providers>
          <AppRouterEvents />
          <GlobalLoader />
          <GlobalAiAnalysisLoader />
          {children} {/* Ensure children are rendered here */}
        </Providers>
      </body>
    </html>
  );
}
