"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { PageHeader, Spinner } from "@/components/admin/common";
import { get } from "@/lib/api";
import { formatMoney } from "@/lib/money";

interface Revenue {
  byCurrency: { currency: string; fees: number; adRevenue: number; cashIn: number; payoutsSent: number; creatorLiability: number; advertiserLiability: number; balanced: boolean }[];
  daily: { date: string; fees: number; adRevenue: number; volume: number }[];
  ai: { jobs30d: number; costUsd30d: number };
  pending: { payouts: number; kyc: number; ads: number };
}

export default function RevenuePage() {
  const { data, isLoading } = useQuery({ queryKey: ["revenue"], queryFn: () => get<Revenue>("/admin/revenue"), refetchInterval: 60_000 });
  if (isLoading || !data) return <Spinner className="mx-auto mt-10 size-6" />;
  const cur = data.byCurrency[0]?.currency ?? "USD";
  const max = Math.max(1, ...data.daily.map((d) => d.fees + d.adRevenue));
  return (
    <>
      <PageHeader title="Revenue" desc="Straight from the double-entry ledger. Every currency must balance to zero — if it doesn't, money moved without a matching entry." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Link href="/payouts" className="rounded-xl border bg-card p-4 hover:bg-accent/40"><p className="text-xs text-muted-foreground uppercase">Payouts waiting</p><p className="text-2xl font-bold">{data.pending.payouts}</p></Link>
        <Link href="/payouts" className="rounded-xl border bg-card p-4 hover:bg-accent/40"><p className="text-xs text-muted-foreground uppercase">Identity checks waiting</p><p className="text-2xl font-bold">{data.pending.kyc}</p></Link>
        <Link href="/ad-review" className="rounded-xl border bg-card p-4 hover:bg-accent/40"><p className="text-xs text-muted-foreground uppercase">Ads waiting</p><p className="text-2xl font-bold">{data.pending.ads}</p></Link>
      </div>
      {data.byCurrency.length === 0 && <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No money has moved yet.</p>}
      {data.byCurrency.map((c) => (
        <section key={c.currency} className="mb-4 rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{c.currency}</h2>
            {c.balanced
              ? <span className="flex items-center gap-1 text-sm text-emerald-500"><CheckCircle2 className="size-4" /> Ledger balanced</span>
              : <span className="flex items-center gap-1 text-sm text-destructive"><XCircle className="size-4" /> Ledger out of balance — investigate</span>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            {[
              ["Platform fees", c.fees], ["Ad revenue", c.adRevenue], ["Received from providers", c.cashIn], ["Paid out to creators", c.payoutsSent],
              ["Owed to creators", c.creatorLiability], ["Advertiser prepaid balances", c.advertiserLiability],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="font-bold tabular-nums">{formatMoney(v as number, c.currency)}</p></div>
            ))}
          </div>
        </section>
      ))}
      <section className="mb-4 rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-semibold">Platform revenue · last 30 days</h2>
        <div className="flex h-40 items-end gap-1">
          {data.daily.map((d) => (
            <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={`${d.date}: fees ${formatMoney(d.fees, cur)}, ads ${formatMoney(d.adRevenue, cur)}, volume ${formatMoney(d.volume, cur)}`}>
              <div className="w-full rounded-t bg-primary/80" style={{ height: `${(d.adRevenue / max) * 100}%` }} />
              <div className="w-full bg-emerald-500/80" style={{ height: `${(d.fees / max) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" /> Creator fees</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" /> Ad revenue</span>
        </div>
      </section>
      <section className="rounded-xl border bg-card p-4 text-sm">
        <h2 className="mb-1 font-semibold">AI Ad Studio · last 30 days</h2>
        <p className="text-muted-foreground">{data.ai.jobs30d} jobs · estimated AI cost ${data.ai.costUsd30d.toFixed(2)}</p>
      </section>
    </>
  );
}
