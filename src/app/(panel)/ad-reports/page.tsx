"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, FilterChips, PageHeader, ReasonDialog, Spinner } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { del, errorMessage, get, post } from "@/lib/api";
import { useAdminAuth } from "@/providers/providers";
import { PurgeButton } from "@/components/admin/purge";

type Status = "open" | "actioned" | "dismissed";
interface Item {
  creativeId: string; reports: number; reasons: string[]; details: string[]; lastAt: string;
  ad: { headline: string; body: string; media: { id: string; url: string; type: string }[]; status: string; reviewReason: string | null; linkUrl: string | null };
  campaign: { id: string; name: string }; business: { name: string; slug: string };
}
const REASON: Record<string, string> = { misleading: "Misleading", scam: "Scam", offensive: "Offensive", sexual: "Sexual", violence: "Violence", prohibited: "Prohibited product", other: "Other" };

export default function AdReportsPage() {
  const qc = useQueryClient();
  const { can } = useAdminAuth();
  const canAct = can("ads.review");
  const [status, setStatus] = useState<Status>("open");
  const [takingDown, setTakingDown] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["ad-reports", status], queryFn: () => get<{ items: Item[] }>(`/admin/ads/reports?status=${status}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["ad-reports"] });
  const dismiss = useMutation({
    mutationFn: (id: string) => post(`/admin/ads/reports/${id}`, { action: "dismiss" }),
    onSuccess: () => { toast.success("Reports dismissed — the ad keeps running"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Ad reports" desc="Ads people reported from their feed. Five reports pause an ad automatically until you decide. Dismiss lets it run again; Take down stops it and tells the advertiser why.">
        <FilterChips<Status> value={status} onChange={setStatus} options={[{ v: "open", label: "Open" }, { v: "actioned", label: "Taken down" }, { v: "dismissed", label: "Dismissed" }]} />
      </PageHeader>
      {isLoading && <Spinner className="mx-auto mt-10 size-6" />}
      {data?.items.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nothing here.</p>}
      <div className="grid gap-4 xl:grid-cols-2">
        {data?.items.map((r) => (
          <article key={r.creativeId} className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold">{r.business.name}</span>
              <span className="text-muted-foreground">· {r.campaign.name}</span>
              <Badge variant="outline" className="capitalize">{r.ad.status === "rejected" ? "taken down" : r.ad.status.replace("_", " ")}</Badge>
              <span className="order-last ml-auto">
                <PurgeButton iconOnly what={`the ${r.reports} report(s) on this ad`} details="Only the reports are erased. To delete the ad itself, use Live ads." onConfirm={() => del(`/admin/ads/reports/${r.creativeId}`)} onDone={refresh} />
              </span>
              <span className="ml-auto text-muted-foreground"><Ago date={r.lastAt} /></span>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge className="border-0 bg-destructive/15 text-destructive">{r.reports} report{r.reports > 1 ? "s" : ""}</Badge>
              {r.reasons.map((x) => <Badge key={x} variant="outline">{REASON[x] ?? x}</Badge>)}
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs font-medium text-muted-foreground">Sponsored</p>
              <p className="font-semibold">{r.ad.headline}</p>
              {r.ad.body && <p className="mt-0.5 text-sm whitespace-pre-wrap">{r.ad.body}</p>}
              {r.ad.media.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {r.ad.media.map((m) => m.type === "video" ? <video key={m.id} src={m.url} controls className="h-28 rounded" /> : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.id} src={m.url} alt="" className="h-28 rounded object-cover" />
                  ))}
                </div>
              )}
              {r.ad.linkUrl && <a href={r.ad.linkUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="size-3" /> {r.ad.linkUrl}</a>}
            </div>
            {r.details.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{r.details.map((d, i) => <li key={i}>“{d}”</li>)}</ul>
            )}
            {r.ad.reviewReason && <p className="mt-2 text-xs text-warning">{r.ad.reviewReason}</p>}
            {canAct && status === "open" && (
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="secondary" disabled={dismiss.isPending} onClick={() => dismiss.mutate(r.creativeId)}><CheckCircle2 /> Dismiss</Button>
                <Button size="sm" variant="destructive" onClick={() => setTakingDown(r.creativeId)}><XCircle /> Take down</Button>
              </div>
            )}
          </article>
        ))}
      </div>
      <ReasonDialog
        open={!!takingDown}
        onOpenChange={(o) => !o && setTakingDown(null)}
        title="Take down ad"
        description="The ad stops running at once. The advertiser sees your reason."
        confirmLabel="Take down"
        onConfirm={(reason) => post(`/admin/ads/reports/${takingDown}`, { action: "takedown", reason }).then(() => { toast.success("Ad taken down"); setTakingDown(null); refresh(); }).catch((e) => toast.error(errorMessage(e)))}
      />
    </>
  );
}
