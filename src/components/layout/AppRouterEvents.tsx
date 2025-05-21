
"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLoader } from "@/contexts/LoaderContext";

export function AppRouterEvents() {
  const { showLoader, hideLoader } = useLoader();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Show loader when the path/params change, indicating a new page render is starting
    showLoader();

    // Clear any existing timeout from a previous render/navigation
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }

    // Set a new timeout to hide the loader after a short delay
    // This allows content to start rendering before the loader disappears.
    timeoutIdRef.current = setTimeout(() => {
      hideLoader();
    }, 500); // Adjusted delay to 500ms, can be tweaked

    // Cleanup function: will be called when the component unmounts
    // or before the effect runs again due to dependency changes.
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      // It's generally safer to also hide the loader on unmount,
      // in case the timeout didn't get to run (e.g., very fast navigation away)
      // However, ensure this doesn't cause issues if new page's loader shows immediately.
      // For now, let's ensure the timeout is the primary mechanism for hiding.
      // If loaders get stuck, this hideLoader() call on unmount might be necessary.
    };
  }, [pathname, searchParams, showLoader, hideLoader]); // Effect dependencies

  return null; // This component doesn't render anything itself
}
