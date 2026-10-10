"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-brand print:hidden">
      <Printer className="size-4" /> Print / Save as PDF
    </button>
  );
}
