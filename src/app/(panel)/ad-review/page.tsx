"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Sparkles, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, FilterChips, PageHeader, ReasonDialog, Spinner } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { del, errorMessage, get, post } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useAdminAuth } from "@/providers/providers";

type Status = "live" | "rejected" | "all";
interface Item {
  id: string; label: string; headline: string; body: string; cta: string; linkUrl: string | null; media: { id: string; url: string; type: string }[]; hashtags: string[];
  source: "manual" | "ai"; status: string; reviewReason: string | null; policyFlags: string[]; claimsToVerify: string[]; claimsConfirmed: boolean; reviewedAt: string | null;
  campaign: { id: string; name: string; objective: string; status: string; dailyBudgetMinor: number; currency: string };
  business: { id: string; name: string; slug: string; verification: string; approvedAds: number };
  brief: Record<string, unknown> | null; engine: string | null;
}

export default function AdReviewPage() {
  const qc = useQueryClient();
  const { can } = useAdminAuth();
  const [status, setStatus] = useState<Status>("live");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["ad-review", status], queryFn: () => get<{ items: Item[] }>(`/admin/ads/review?status=${status}`) });

  const canReview = can("ads.review");
  const canDelete = can("ads.manage");

  return (
    <>
      <PageHeader title="Live ads" desc="Ads run without per-ad approval once their business page is approved (Advertisers). Banned categories are refused automatically. Take down anything that breaks the rules — the advertiser sees your reason.">
        <FilterChips<Status> value={status} onChange={setStatus} options={[{ v: "live", label: "Running now" }, { v: "rejected", label: "Taken down" }, { v: "all", label: "All ads" }]} />
      </PageHeader>
      {isLoading && <Spinner className="mx-auto mt-10 size-6" />}
      {data?.items.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{status === "live" ? "No ads are running right now." : "Nothing here."}</p>}
      <div className="grid gap-4 xl:grid-cols-2">
        {data?.items.map((a) => (
          <article key={a.id} className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold">{a.business.name}</span>
              <Badge variant="outline" className={a.business.verification === "verified" ? "border-emerald-500/40 text-emerald-500" : "border-warning/40 text-warning"}>{a.business.verification}</Badge>
              <span className="text-muted-foreground">· {a.business.approvedAds} approved before</span>
              {a.source === "ai" && <Badge variant="outline" className="border-primary/40 text-primary"><Sparkles className="size-3" /> AI{a.engine === "template" ? " (template)" : ""}</Badge>}
              <span className="ml-auto text-muted-foreground"><Ago date={a.reviewedAt ?? new Date().toISOString()} /></span>
            </div>
            <p className="text-xs text-muted-foreground">Campaign “{a.campaign.name}” · {a.campaign.objective} · {formatMoney(a.campaign.dailyBudgetMinor, a.campaign.currency)}/day · variant {a.label}{status === "all" && <> · ad {a.status === "rejected" ? "taken down" : a.status.replace("_", " ")} · campaign {a.campaign.status.replace("_", " ")}</>}</p>
            <div className="mt-2 rounded-lg border bg-background p-3">
              <p className="text-xs font-medium text-muted-foreground">Sponsored</p>
              <p className="font-semibold">{a.headline}</p>
              {a.body && <p className="mt-0.5 text-sm whitespace-pre-wrap">{a.body}</p>}
              {a.hashtags.length > 0 && <p className="mt-1 text-sm text-primary">{a.hashtags.join(" ")}</p>}
              {a.media.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {a.media.map((m) => m.type === "video" ? <video key={m.id} src={m.url} controls className="h-32 rounded" /> : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.id} src={m.url} alt="" className="h-32 rounded object-cover" />
                  ))}
                </div>
              )}
              {a.linkUrl && <p className="mt-2 truncate text-xs text-muted-foreground">Link: {a.linkUrl}</p>}
            </div>
            {a.policyFlags.length > 0 && <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive"><ShieldAlert className="size-4" /> Flags: {a.policyFlags.join(", ")}</p>}
            {a.claimsToVerify.length > 0 && <p className="mt-1 text-sm">Claims: {a.claimsToVerify.join(", ")} — {a.claimsConfirmed ? <span className="text-emerald-500">confirmed by advertiser</span> : <span className="text-warning">not confirmed</span>}</p>}
            {a.brief && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">AI product brief</summary>
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">{JSON.stringify(a.brief, null, 2)}</pre>
              </details>
            )}
            {a.reviewReason && <p className="mt-2 text-xs text-muted-foreground">Note: {a.reviewReason}</p>}
            {((status === "live" && canReview) || canDelete) && (
              <div className="mt-3 flex justify-end gap-2">
                {status === "live" && canReview && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRejecting(a.id)}><XCircle /> Take down</Button>}
                {canDelete && <Button size="sm" variant="destructive" onClick={() => setDeleting(a.id)}><Trash2 /> Delete</Button>}
              </div>
            )}
          </article>
        ))}
      </div>
      <ReasonDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete ad permanently"
        description="The ad and its stats are deleted and can't be restored. Spend already charged stays on the campaign. If it was the campaign's last ad, the campaign ends. The advertiser is told why."
        confirmLabel="Delete"
        onConfirm={(reason) => del(`/admin/ads/creatives/${deleting}`, { reason }).then(() => { toast.success("Ad deleted"); setDeleting(null); qc.invalidateQueries({ queryKey: ["ad-review"] }); }).catch((e) => toast.error(errorMessage(e)))}
      />
      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Take down ad"
        description="The ad stops running immediately. The advertiser sees this reason."
        confirmLabel="Take down"
        onConfirm={(reason) => post(`/admin/ads/creatives/${rejecting}/review`, { approve: false, reason }).then(() => { toast.success("Taken down"); setRejecting(null); qc.invalidateQueries({ queryKey: ["ad-review"] }); }).catch((e) => toast.error(errorMessage(e)))}
      />
    </>
  );
}
