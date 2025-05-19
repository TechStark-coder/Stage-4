
"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLoader } from "@/contexts/LoaderContext";

export function AppRouterEvents() {
  const { showLoader, hideLoader } = useLoader();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Show loader on route change start
    // Next.js App Router doesn't have a direct 'routeChangeStart' like pages router.
    // We use pathname and searchParams changes to approximate this.
    // This might show loader briefly even if page is cached.
    showLoader(); 
    
    // Hide loader on route change complete
    // The actual hiding will happen once the new page content has triggered its own hideLoader or completed loading.
    // This effect will re-run, and if it's a quick transition, hideLoader might be called quickly.
    // For longer loads, components themselves should manage hideLoader.
    const timeoutId = setTimeout(hideLoader, 300); // Small delay to allow page content to load

    return () => {
      clearTimeout(timeoutId);
      hideLoader(); // Ensure loader is hidden if component unmounts before timeout
    };
  }, [pathname, searchParams, showLoader, hideLoader]);

  return null; // This component doesn't render anything itself
}
