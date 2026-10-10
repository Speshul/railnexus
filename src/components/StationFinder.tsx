"use client";
import { useRouter } from "next/navigation";
import { StationInput } from "./StationInput";

export function StationFinder() {
  const router = useRouter();
  return <StationInput label="Station" value={null} onChange={(s) => s && router.push(`/station/${s.code}`)} />;
}
