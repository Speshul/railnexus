"use client";
import { useActionState, useState } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { cancelPassengers, type CancelState } from "@/app/actions/booking";
import { inr } from "@/lib/format";

type Row = { idx: number; name: string; status: string; fare: number; charge: number; refund: number; rule: string };

/** Pick passengers to cancel; shows the charge/refund for each before anything happens. */
export function CancelPanel({ tripId, bookingId, pnr, rows, blockedReason }: {
  tripId: string; bookingId: string; pnr: string; rows: Row[]; blockedReason?: string;
}) {
  const [state, action, pending] = useActionState<CancelState, FormData>(cancelPassengers, undefined);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const chosen = rows.filter((r) => picked.has(r.idx));
  const refund = chosen.reduce((s, r) => s + r.refund, 0);

  if (state?.done) {
    return (
      <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-ok">
        Cancelled. {state.done.refund > 0 ? <>Refund of <b>{inr(state.done.refund)}</b> initiated ({state.done.refundId}); test-mode refunds complete instantly.</> : "No refund was due."}
      </p>
    );
  }
  if (!rows.length) return blockedReason ? <p className="text-xs text-slate-500">{blockedReason}</p> : null;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary py-1.5 text-sm">
        <Undo2 className="size-4" /> Cancel passengers
      </button>
    );
  }
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Cancel ${chosen.length} passenger(s) on PNR ${pnr}? Refund: ${inr(refund)}. This can't be undone.`)) e.preventDefault();
      }}
      className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
    >
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="font-semibold">Choose who to cancel</p>
      {rows.map((r) => (
        <label key={r.idx} className="flex cursor-pointer items-start gap-2 rounded-md bg-white p-2">
          <input type="checkbox" name="idx" value={r.idx} className="mt-1 accent-brand" checked={picked.has(r.idx)}
            onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(r.idx); else n.delete(r.idx); return n; })} />
          <span className="flex-1">
            <b>{r.name}</b> <span className="text-xs text-slate-500">{r.status}</span>
            <span className="block text-xs text-slate-500">{r.rule}</span>
          </span>
          <span className="text-right text-xs">
            Fare {inr(r.fare)}<br />Charge −{inr(r.charge)}<br /><b className="text-ok">Refund {inr(r.refund)}</b>
          </span>
        </label>
      ))}
      <p className="text-xs text-slate-500">Convenience fee and insurance are not refundable.</p>
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-bad">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn bg-bad text-white hover:bg-red-800" disabled={pending || !chosen.length}>
          {pending && <Loader2 className="size-4 animate-spin" />} Cancel {chosen.length || ""} · refund {inr(refund)}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Keep ticket</button>
      </div>
    </form>
  );
}
