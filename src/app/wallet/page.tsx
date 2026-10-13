import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { TOPUP_MAX, TOPUP_MIN, walletBalance, walletHistory } from "@/lib/wallet";
import { safeNext } from "@/lib/redirect";
import { inr } from "@/lib/format";
import { WalletTopUp } from "@/components/WalletTopUp";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/core";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("wallet.meta") };
}

export default async function WalletPage({ searchParams }: PageProps<"/wallet">) {
  const sp = await searchParams;
  const user = await requireUser("/wallet");
  const t = await getT();
  const balance = await walletBalance(user.id);
  const history = await walletHistory(user.id);
  const add = Math.min(TOPUP_MAX, Math.max(TOPUP_MIN, Number(sp.add) || 0));
  const returnTo = typeof sp.return === "string" ? safeNext(sp.return) : null;
  const when = (ms: number) => new Date(ms).toLocaleString(t.locale === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-4 font-sign text-[2.16rem] leading-tight text-brand">{t("wallet.title")}</h1>
      <div className="grid grid-cols-[1fr_1.1fr] gap-6">
        {/* The wallet balance: a royal-blue plate with the amount lettered in marigold. */}
        <section className="flex flex-col justify-between rounded-2xl bg-brand p-8 text-white">
          <p className="flex items-center gap-2 font-sign text-[1.08rem] text-accent"><Wallet className="size-5" aria-hidden /> {t("wallet.balance")}</p>
          <p className="mt-2 font-sign text-[3.6rem] font-bold leading-tight text-accent">{inr(balance / 100, true)}</p>
          <p className="mt-4 max-w-[40ch] text-white/90">{t("wallet.why")}</p>
        </section>
        <section className="card p-7">
          <h2 className="mb-3 font-sign text-[1.15rem] leading-tight text-brand">{t("wallet.addMoney")}</h2>
          <WalletTopUp initial={sp.add ? add : 0} min={TOPUP_MIN} max={TOPUP_MAX} returnTo={returnTo} />
          {returnTo && <p className="mt-3 text-[0.9rem] text-slate-600">{t("wallet.returnNote")} <Link href={returnTo} className="text-brand underline">{t("wallet.backToBooking")}</Link></p>}
        </section>
      </div>

      <section className="card mt-6 overflow-hidden">
        <h2 className="border-b-2 border-ground px-7 py-4 font-sign text-[1.15rem] leading-tight text-brand">{t("wallet.history")}</h2>
        {history.length === 0 ? (
          <p className="px-7 py-5 text-slate-600">{t("wallet.empty")}</p>
        ) : (
          <ul className="divide-y-2 divide-ground">
            {history.map((x) => (
              <li key={x.id} className="flex items-center gap-4 px-7 py-3.5">
                {x.amount_paise > 0
                  ? <ArrowDownLeft className="size-7 shrink-0 rounded-full bg-brand-light p-1 text-brand" aria-hidden />
                  : <ArrowUpRight className="size-5 shrink-0 rounded-full bg-slate-100 p-0.5 text-slate-600" aria-hidden />}
                <span className="flex-1">
                  <span className="font-medium">{t(`wallet.kind.${x.kind}` as MessageKey)}</span>
                  {x.ref && x.kind !== "topup" && <span className="ml-1 font-sign text-[0.95rem] text-slate-500">{x.ref}</span>}
                  <span className="block text-sm text-slate-500">{when(x.created_at)}</span>
                </span>
                <span className="text-right">
                  <span className={`block font-semibold ${x.amount_paise > 0 ? "text-ok" : ""}`}>{x.amount_paise > 0 ? "+" : "−"}{inr(Math.abs(x.amount_paise) / 100, true)}</span>
                  <span className="block text-sm text-slate-500">{t("wallet.after", { amount: inr(x.balance_after / 100, true) })}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
