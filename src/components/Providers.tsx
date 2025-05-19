
"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { LoaderProvider } from "@/contexts/LoaderContext";
import { AiAnalysisLoaderProvider } from "@/contexts/AiAnalysisLoaderContext"; // Import the provider
import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient();

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LoaderProvider>
          <AiAnalysisLoaderProvider> {/* Wrap children with the AI loader provider */}
            {children}
            <Toaster />
          </AiAnalysisLoaderProvider>
        </LoaderProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
