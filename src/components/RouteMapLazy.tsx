"use client";
import dynamic from "next/dynamic";

// Leaflet touches `window`, so the map only renders in the browser.
export const RouteMapLazy = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-lg bg-slate-100" />,
});
