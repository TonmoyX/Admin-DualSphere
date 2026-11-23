"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Search, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, FilterChips, PageHeader, ReasonDialog, Spinner } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage, get, post } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type Range = "today" | "7d" | "30d" | "lifetime";
interface Metrics { impressions: number; reach: number; clicks: number; spendMinor: number; ctr: number; cpcMinor: number | null; cpmMinor: number | null; frequency: number }
interface Overview {
  totals: Metrics; series: (Metrics & { at: string })[]; openReports: number; prepaidBalanceMinor: number;
  campaigns: { active: number; paused: number; waiting: number; advertisers: number };
  topAdvertisers: (Metrics & { id: string; name: string; slug: string })[];
}
interface Camp {
  id: string; name: string; objective: string; status: string; dailyBudgetMinor: number; totalBudgetMinor: number | null; spentMinor: number; pauseReason: string | null;
  staffPaused: boolean; impressions: number; clicks: number; ads: number; updatedAt?: string; createdAt: string; business: { name: string; slug: string; verification: string };
}
const num = (n: number) => n.toLocaleString("en-US");
const usd = (minor: number) => `$${(minor / 100).toFixed(2)}`;

export default function AdsOverviewPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState<Range>("7d");
  const [status, setStatus] = useState("active");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [asking, setAsking] = useState<{ c: Camp; action: "pause" | "end" } | null>(null);
  const overview = useQuery({ queryKey: ["ads-overview", range], queryFn: () => get<Overview>(`/admin/ads/overview?range=${range}`), refetchInterval: 60_000 });
  const campaigns = useQuery({ queryKey: ["ads-campaigns", status, search], queryFn: () => get<{ items: Camp[] }>(`/admin/ads/campaigns?status=${status}${search ? `&q=${encodeURIComponent(search)}` : ""}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ads-campaigns"] }); qc.invalidateQueries({ queryKey: ["ads-overview"] }); };
  const resume = useMutation({
    mutationFn: (id: string) => post(`/admin/ads/campaigns/${id}/status`, { action: "resume" }),
    onSuccess: () => { toast.success("Campaign can run again"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const o = overview.data;
  const max = Math.max(1, ...(o?.series ?? []).map((p) => p.spendMinor));

  return (
    <>
      <PageHeader title="Ads overview" desc="Every campaign on DualSphere. Pause or end any campaign — the advertiser sees your reason and can't turn a staff-paused campaign back on.">
        <FilterChips<Range> value={range} onChange={setRange} options={[{ v: "today", label: "Today" }, { v: "7d", label: "7 days" }, { v: "30d", label: "30 days" }, { v: "lifetime", label: "Lifetime" }]} />
      </PageHeader>

      {overview.isLoading && <Spinner className="mx-auto my-8" />}
      {o && (
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            {[
              ["Ad spend", usd(o.totals.spendMinor)], ["Impressions", num(o.totals.impressions)], ["Reach (est.)", num(o.totals.reach)], ["Clicks", num(o.totals.clicks)],
              ["CTR", `${(o.totals.ctr * 100).toFixed(2)}%`], ["Active campaigns", num(o.campaigns.active)], ["Active advertisers", num(o.campaigns.advertisers)], ["Prepaid balances", formatMoney(o.prepaidBalanceMinor)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="text-lg font-bold tabular-nums">{v}</p></div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="rounded-xl border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Ad spend over time</p>
              <div className="flex h-36 items-end gap-[2px]">
                {o.series.map((p) => (
                  <div key={p.at} className="group relative flex h-full flex-1 flex-col justify-end">
                    <div className="rounded-t bg-primary/70 group-hover:bg-primary" style={{ height: `${p.spendMinor > 0 ? Math.max(3, (p.spendMinor / max) * 100) : 0}%` }} />
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-popover px-2 py-1 text-[11px] whitespace-nowrap shadow group-hover:block">
                      {new Date(p.at).toLocaleString("en-US", range === "today" ? { hour: "numeric" } : { month: "short", day: "numeric" })} · {usd(p.spendMinor)} · {num(p.impressions)} views
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="mb-2 text-sm font-semibold">Top advertisers</p>
              {o.topAdvertisers.length === 0 && <p className="text-sm text-muted-foreground">No spend in this period.</p>}
              <div className="space-y-2">
                {o.topAdvertisers.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{a.name}</span><span className="tabular-nums text-muted-foreground">{usd(a.spendMinor)} · {num(a.impressions)} views</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">{o.campaigns.paused} paused · {o.campaigns.waiting} waiting for page approval · {o.openReports} ads with open reports</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }} className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} placeholder="Campaign or business" className="pl-8" />
        </form>
        <FilterChips value={status} onChange={setStatus} options={[
          { v: "active", label: "Running" }, { v: "paused", label: "Paused" }, { v: "staff_paused", label: "Paused by staff" }, { v: "pending_review", label: "Waiting" },
          { v: "draft", label: "Drafts" }, { v: "completed", label: "Ended" }, { v: "all", label: "All" },
        ]} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        {campaigns.isLoading && <Spinner className="mx-auto my-8" />}
        {campaigns.data?.items.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nothing here.</p>}
        {!!campaigns.data?.items.length && (
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr className="text-right [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium"><th className="text-left">Campaign</th><th className="text-left">Business</th><th>Budget</th><th>Impressions</th><th>Clicks</th><th>Spent</th><th className="text-left">Updated</th><th /></tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.data.items.map((c) => (
                <tr key={c.id} className="text-right tabular-nums [&>td]:px-3 [&>td]:py-2.5">
                  <td className="max-w-72 text-left">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"><Badge variant="outline" className="text-[10px] capitalize">{c.status.replace("_", " ")}</Badge> {c.objective} · {c.ads} ads</p>
                    {c.pauseReason && c.status !== "active" && <p className={`truncate text-xs ${c.staffPaused ? "text-destructive" : "text-muted-foreground"}`}>{c.pauseReason}</p>}
                  </td>
                  <td className="text-left">{c.business.name}<span className="block text-xs text-muted-foreground">/{c.business.slug}</span></td>
                  <td>{formatMoney(c.dailyBudgetMinor)}/day</td>
                  <td>{num(c.impressions)}</td>
                  <td>{num(c.clicks)}</td>
                  <td className="font-semibold">{formatMoney(c.spentMinor)}</td>
                  <td className="text-left text-xs text-muted-foreground"><Ago date={c.updatedAt ?? c.createdAt} /></td>
                  <td>
                    <div className="flex justify-end gap-1">
                      {c.staffPaused && c.status === "paused" && <Button size="xs" variant="secondary" disabled={resume.isPending} onClick={() => resume.mutate(c.id)}><Play /> Resume</Button>}
                      {(c.status === "active" || c.status === "pending_review" || (c.status === "paused" && !c.staffPaused)) && <Button size="xs" variant="ghost" className="text-destructive" onClick={() => setAsking({ c, action: "pause" })}><Pause /> Pause</Button>}
                      {c.status !== "completed" && <Button size="xs" variant="ghost" className="text-destructive" onClick={() => setAsking({ c, action: "end" })}><Square /> End</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <ReasonDialog
        open={!!asking}
        onOpenChange={(v) => !v && setAsking(null)}
        title={asking?.action === "end" ? `End “${asking?.c.name}”` : `Pause “${asking?.c.name}”`}
        description={asking?.action === "end" ? "The campaign stops for good. The advertiser is told why." : "The campaign stops serving until staff resume it. The advertiser is told why and can't turn it back on."}
        confirmLabel={asking?.action === "end" ? "End campaign" : "Pause"}
        onConfirm={(reason) => post(`/admin/ads/campaigns/${asking!.c.id}/status`, { action: asking!.action, reason }).then(() => { toast.success("Done"); setAsking(null); refresh(); }).catch((e) => toast.error(errorMessage(e)))}
      />
    </>
  );
}
