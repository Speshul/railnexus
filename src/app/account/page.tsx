import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Ticket, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { departureMs, listTrips, savedPassengers, type Trip } from "@/lib/booking";
import { formatDate } from "@/lib/dates";
import { inr, statusTone } from "@/lib/format";
import { removeSavedPassenger } from "@/app/actions/booking";
import { getT } from "@/i18n/server";
import type { T } from "@/i18n/core";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("acct.meta") };
}

type Tab = "upcoming" | "past" | "pending" | "cancelled";
const TABS: { key: Tab; label: "acct.tab.upcoming" | "acct.tab.past" | "acct.tab.pending" | "acct.tab.cancelled" }[] = [
  { key: "upcoming", label: "acct.tab.upcoming" },
  { key: "past", label: "acct.tab.past" },
  { key: "pending", label: "acct.tab.pending" },
  { key: "cancelled", label: "acct.tab.cancelled" },
];

function tabOf(t: Trip): Tab {
  if (t.status === "PENDING_PAYMENT") return "pending";
  if (t.status === "CONFIRMED") return departureMs(t.legs[t.legs.length - 1]) > Date.now() ? "upcoming" : "past";
  return "cancelled";
}

function TripCard({ t, tr }: { t: Trip; tr: T }) {
  const first = t.legs[0];
  const last = t.legs[t.legs.length - 1];
  const pax = first.passengers;
  return (
    <article className="card overflow-hidden">
      <Link href={`/booking/${t.id}`} className="block p-4 hover:bg-slate-50">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-1 font-semibold">
              {first.fare.fromName} <ArrowRight className="size-4 text-slate-400" aria-hidden /> {last.fare.toName}
              {t.legs.length > 1 && (
                <span className="rounded bg-brand-light px-1.5 text-xs font-medium text-brand">
                  {t.legs[0].train_number === t.legs[1].train_number ? tr("acct.split") : tr("acct.oneChange")}
                </span>
              )}
            </div>
            <div className="text-sm text-slate-600">
              {formatDate(first.journey_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }, tr.locale)} · {first.fare.dep} ·{" "}
              {t.legs.map((b) => `${b.train_number} (${b.class_code})`).join(" + ")} · {tr.n("acct.pax", pax.length)}
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold">{inr(t.totalPaise / 100, true)}</div>
            {t.refundPaise > 0 && <div className="text-xs text-ok">{tr("acct.refunded", { amount: inr(t.refundPaise / 100, true) })}</div>}
          </div>
        </div>
        {t.status === "CONFIRMED" && (
          <div className="mt-2 space-y-1">
            {t.legs.map((b) => (
              <div key={b.id} className="flex flex-wrap gap-x-3 text-xs">
                <span className="font-mono text-slate-500">{tr("pnr.pnr", { n: b.pnr ?? "" })}</span>
                {b.passengers.filter((p) => p.age >= 5).map((p) => (
                  <span key={p.idx} className={`font-mono font-semibold ${statusTone(p.cancelled ? "CAN" : p.status)}`}>{p.status === "CAN" ? tr("acct.paxCancelled", { name: p.name.split(" ")[0] }) : p.status}</span>
                ))}
              </div>
            ))}
          </div>
        )}
        {t.status === "PENDING_PAYMENT" && <p className="mt-2 text-xs font-medium text-warn">{tr("acct.held")}</p>}
      </Link>
      {t.status === "CONFIRMED" && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-2">
          {t.legs.filter((b) => b.status === "CONFIRMED").map((b) => (
            <Link key={b.id} href={`/ticket/${b.pnr}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              <Ticket className="size-4" aria-hidden /> {tr("acct.eticket", { train: t.legs.length > 1 ? b.train_number : "" }).trim()}
            </Link>
          ))}
          <Link href={`/booking/${t.id}`} className="ml-auto text-sm text-slate-600 hover:underline">{tr("acct.manage")}</Link>
        </div>
      )}
    </article>
  );
}

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const user = await requireUser("/account");
  const sp = await searchParams;
  const trips = await listTrips(user.id);
  const grouped = Object.fromEntries(TABS.map((x) => [x.key, trips.filter((t) => tabOf(t) === x.key)])) as Record<Tab, Trip[]>;
  const requested = typeof sp.tab === "string" && TABS.some((x) => x.key === sp.tab) ? (sp.tab as Tab) : null;
  const tab: Tab = requested ?? (grouped.pending.length ? "pending" : "upcoming");
  // upcoming: soonest first; everything else: most recent first
  const list = tab === "upcoming" ? [...grouped.upcoming].sort((a, b) => departureMs(a.legs[0]) - departureMs(b.legs[0])) : grouped[tab];
  const passengers = await savedPassengers(user.id);
  const tr = await getT();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-bold">{tr("acct.title")}</h1>
      <p className="mb-5 text-sm text-slate-600">{user.full_name} · @{user.username} · {user.email}</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section>
          <nav className="mb-3 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm" aria-label={tr("acct.filters")}>
            {TABS.map((x) => (
              <Link key={x.key} href={`/account?tab=${x.key}`} aria-current={tab === x.key ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 ${tab === x.key ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {tr(x.label)} <span className={tab === x.key ? "text-white/90" : "text-slate-500"}>({grouped[x.key].length})</span>
              </Link>
            ))}
          </nav>
          {list.length === 0 ? (
            <div className="card p-6 text-center text-sm text-slate-600">
              {tr("acct.empty")} <Link href="/" className="text-brand underline">{tr("acct.search")}</Link>
            </div>
          ) : (
            <div className="space-y-3">{list.map((t) => <TripCard key={t.id} t={t} tr={tr} />)}</div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">{tr("acct.saved")}</h2>
          <div className="card divide-y divide-slate-100">
            {passengers.length === 0 && <p className="p-4 text-sm text-slate-500">{tr("acct.savedEmpty")}</p>}
            {passengers.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 text-sm">
                <span><b>{p.name}</b> <span className="text-slate-500">{p.age} · {tr(`gshort.${p.gender}` as "gshort.M")}{p.berth_pref && ` · ${p.berth_pref}`}</span></span>
                <form action={removeSavedPassenger.bind(null, p.id)}>
                  <button aria-label={tr("acct.remove", { name: p.name })} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-bad"><Trash2 className="size-4" aria-hidden /></button>
                </form>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
