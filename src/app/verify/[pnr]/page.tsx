import type { Metadata } from "next";
import { timingSafeEqual } from "node:crypto";
import { BadgeCheck, ShieldX } from "lucide-react";
import { getBookingByPnr, ticketSignature } from "@/lib/booking";
import { CLASSES } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { statusTone } from "@/lib/format";

export const metadata: Metadata = { title: "Verify ticket" };

// "First L." keeps the check useful for a ticket examiner without exposing full names publicly.
const mask = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
};

/** Target of the QR code on every e-ticket: confirms the ticket was issued by this site and is still valid. */
export default async function VerifyPage({ params, searchParams }: PageProps<"/verify/[pnr]">) {
  const { pnr } = await params;
  const s = (await searchParams).s;
  const sig = typeof s === "string" ? s : "";
  const b = /^\d{10}$/.test(pnr) ? getBookingByPnr(pnr) : null;
  const expected = b ? ticketSignature(pnr) : "";
  const genuine = !!b && sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  const active = genuine ? b!.passengers.filter((p) => !p.cancelled) : [];
  const valid = genuine && b!.status === "CONFIRMED" && active.length > 0;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className={`card overflow-hidden ${valid ? "border-green-300" : "border-red-300"}`}>
        <div className={`flex items-center gap-3 p-5 ${valid ? "bg-green-50 text-ok" : "bg-red-50 text-bad"}`}>
          {valid ? <BadgeCheck className="size-10" /> : <ShieldX className="size-10" />}
          <div>
            <p className="text-lg font-bold">{valid ? "Genuine ticket" : genuine ? "Ticket no longer valid" : "Not a genuine ticket"}</p>
            <p className="text-sm text-slate-600">
              {valid ? "Issued by RailNexus and currently active." : genuine ? "This ticket has been cancelled." : "This QR code wasn't issued by RailNexus, or has been altered."}
            </p>
          </div>
        </div>
        {genuine && (
          <div className="space-y-3 p-5 text-sm">
            <div>
              <div className="font-mono text-xs text-slate-500">PNR {pnr}</div>
              <div className="font-semibold">{b!.train_number} {b!.fare.trainName}</div>
              <div className="text-slate-600">
                {b!.from_code} → {b!.to_code} · {formatDate(b!.journey_date)} · {b!.fare.dep} · {CLASSES[b!.class_code].short}
              </div>
            </div>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {b!.passengers.map((p) => (
                <li key={p.idx} className="flex justify-between px-3 py-2">
                  <span>{mask(p.name)} · {p.age}{p.gender}</span>
                  <span className={`font-mono text-xs font-semibold ${statusTone(p.status)}`}>{p.cancelled ? "CANCELLED" : p.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
