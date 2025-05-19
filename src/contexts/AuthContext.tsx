
"use client";

import type { User } from "firebase/auth";
import { createContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChangedHelper } from "@/lib/auth";
import { auth } from "@/config/firebase";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChangedHelper(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    // Basic full-page loader
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 p-8 rounded-lg shadow-lg bg-card w-full max-w-md text-center">
          <Skeleton className="h-12 w-12 mx-auto rounded-full bg-primary/20" />
          <Skeleton className="h-6 w-3/4 mx-auto bg-muted" />
          <Skeleton className="h-4 w-1/2 mx-auto bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
