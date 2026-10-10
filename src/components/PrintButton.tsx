"use client";
import { Printer } from "lucide-react";
import { useT } from "@/i18n/client";

export function PrintButton() {
  const t = useT();
  return (
    <button onClick={() => window.print()} className="btn-brand print:hidden">
      <Printer className="size-4" aria-hidden /> {t("print.button")}
    </button>
  );
}
