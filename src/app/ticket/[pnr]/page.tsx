import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { Leaf, TrainFront } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBookingByPnr, ticketSignature } from "@/lib/booking";
import { getStops } from "@/lib/rail";
import { APP_NAME, CLASSES, FOOD_PREFS, QUOTAS } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/dates";
import { inr, statusTone } from "@/lib/format";
import { siteOrigin } from "@/lib/origin";
import { co2SavedVsFlight } from "@/lib/carbon";
import { PrintButton } from "@/components/PrintButton";

export async function generateMetadata({ params }: PageProps<"/ticket/[pnr]">): Promise<Metadata> {
  return { title: `E-ticket PNR ${(await params).pnr}` };
}

const GENDER: Record<string, string> = { M: "M", F: "F", T: "T" };
const fullDate = (d: string) => formatDate(d, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export default async function TicketPage({ params }: PageProps<"/ticket/[pnr]">) {
  const { pnr } = await params;
  const user = await requireUser(`/ticket/${pnr}`);
  const b = /^\d{10}$/.test(pnr) ? getBookingByPnr(pnr) : null;
  if (!b || b.user_id !== user.id) notFound();
  const f = b.fare;
  const verifyUrl = `${await siteOrigin()}/verify/${pnr}?s=${ticketSignature(pnr)}`;
  const qr = await QRCode.toString(verifyUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0b2a56", light: "#ffffff" } });
  const halts = getStops(b.train_number).filter((s) => s.halt);
  const from = halts.find((s) => s.code === b.from_code);
  const to = halts.find((s) => s.code === b.to_code);
  const between = from && to ? halts.filter((s) => s.seq > from.seq && s.seq < to.seq).length : 0;
  const active = b.passengers.filter((p) => !p.cancelled);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/booking/${b.trip_id}`} className="text-sm text-brand hover:underline">← Back to booking</Link>
        <PrintButton />
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm print:rounded-none print:border-slate-400 print:shadow-none">
        <header className="flex flex-wrap items-center justify-between gap-3 bg-brand px-6 py-4 text-white print:bg-white print:text-slate-900">
          <div className="flex items-center gap-2">
            <TrainFront className="size-7 text-accent" />
            <div>
              <div className="text-lg font-bold">{APP_NAME} E-Ticket</div>
              <div className="text-xs opacity-80">Electronic Reservation Slip · demo, not valid for travel</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-80">PNR</div>
            <div className="font-mono text-2xl font-bold tracking-widest">{pnr}</div>
          </div>
        </header>

        <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold">{b.train_number} {f.trainName}</h1>
              <p className="text-sm text-slate-600">
                {CLASSES[b.class_code].name} ({b.class_code}) · {QUOTAS[b.quota].name} quota · {f.distance} km · {between} stops in between
              </p>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <div className="text-xs uppercase text-slate-500">Boarding</div>
                <div className="text-2xl font-bold">{f.dep}</div>
                <div className="font-medium">{f.fromName} ({b.from_code})</div>
                <div className="text-sm text-slate-600">{fullDate(b.journey_date)}</div>
              </div>
              <div className="text-center text-xs text-slate-500">{formatDuration(f.duration)}<div className="my-1 h-px w-16 bg-slate-300" /></div>
              <div className="text-right">
                <div className="text-xs uppercase text-slate-500">Arrival</div>
                <div className="text-2xl font-bold">{f.arr}</div>
                <div className="font-medium">{f.toName} ({b.to_code})</div>
                <div className="text-sm text-slate-600">{fullDate(f.arrivalDate)}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="size-36 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} aria-label="Ticket QR code" role="img" />
            <span className="text-[10px] text-slate-500">Scan to verify this ticket</span>
          </div>
        </div>

        <div className="overflow-x-auto px-6">
          <table className="w-full text-sm">
            <thead className="border-y border-slate-200 text-left text-xs uppercase text-slate-500">
              <tr><th className="py-2">#</th><th>Passenger</th><th>Age</th><th>Gender</th><th>Booking status</th><th>Current status</th><th>Meal</th></tr>
            </thead>
            <tbody>
              {b.passengers.map((p, i) => (
                <tr key={p.idx} className="border-b border-slate-100">
                  <td className="py-2">{i + 1}</td>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.age}</td>
                  <td>{GENDER[p.gender]}</td>
                  <td className="font-mono text-xs">{p.booking_status}</td>
                  <td className={`font-mono text-xs font-semibold ${statusTone(p.status)}`}>{p.cancelled ? "CANCELLED" : p.status}</td>
                  <td className="text-xs">{p.food_pref ? FOOD_PREFS[p.food_pref as keyof typeof FOOD_PREFS] : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 p-6 text-sm sm:grid-cols-2">
          <dl className="space-y-1">
            <div className="flex justify-between"><dt className="text-slate-500">Ticket fare</dt><dd>{inr(f.ticketFare)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Convenience fee (incl. GST)</dt><dd>{inr(f.convenienceFee, true)}</dd></div>
            {f.insurance > 0 && <div className="flex justify-between"><dt className="text-slate-500">Travel insurance</dt><dd>{inr(f.insurance, true)}</dd></div>}
            <div className="flex justify-between border-t border-slate-200 pt-1 font-bold"><dt>Total paid</dt><dd>{inr(b.total_paise / 100, true)}</dd></div>
            {b.refund_paise > 0 && <div className="flex justify-between text-ok"><dt>Refunded</dt><dd>{inr(b.refund_paise / 100, true)}</dd></div>}
          </dl>
          <div className="space-y-1 text-xs text-slate-600">
            <p><b>Booked:</b> {b.confirmed_at ? new Date(b.confirmed_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"} · {active.length} of {b.passengers.length} passengers active</p>
            <p><b>Contact:</b> {b.contact_email} · {b.contact_phone}</p>
            {co2SavedVsFlight(f.distance) > 0 && (
              <p className="flex items-center gap-1 text-ok">
                <Leaf className="size-3.5" /> By train instead of flying, you save ~{co2SavedVsFlight(f.distance) * active.filter((p) => p.age >= 5).length} kg CO₂.
              </p>
            )}
            <p>Carry a valid photo ID. RAC passengers may board; waitlisted passengers may not board unless their status confirms.</p>
            <p>Check live status any time at <Link href={`/pnr?n=${pnr}`} className="text-brand underline print:no-underline">PNR status</Link>.</p>
          </div>
        </div>
      </article>
    </div>
  );
}
