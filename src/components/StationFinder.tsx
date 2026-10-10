"use client";
import { useRouter } from "next/navigation";
import { StationInput } from "./StationInput";
import { useT } from "@/i18n/client";

export function StationFinder() {
  const router = useRouter();
  const t = useT();
  return <StationInput label={t("stns.station")} value={null} onChange={(s) => s && router.push(`/station/${s.code}`)} />;
}
