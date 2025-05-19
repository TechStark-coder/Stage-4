
"use client";

import { useLoader } from "@/contexts/LoaderContext";

export function GlobalLoader() {
  const { isLoading } = useLoader();

  if (!isLoading) {
    return null;
  }

  return (
    <>
      <div className="loader-overlay"></div>
      <div className="banter-loader">
        <div className="banter-loader__box"></div>
        <div className="banter-loader__box"></div>
        <div className="banter-loader__box"></div>
        <div className="banter-loader__box"></div>
        <div className="banter-loader__box"></div>
        <div className="banter-loader__box"></div>
        <div className="banter-loader__box"></div>
        <div className="banter-loader__box"></div>
        <div className="banter-loader__box"></div>
      </div>
    </>
  );
}
