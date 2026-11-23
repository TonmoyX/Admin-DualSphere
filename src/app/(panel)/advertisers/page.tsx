"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, BadgeCheck, ExternalLink, Handshake, Pencil, Search, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, FilterChips, PageHeader, ReasonDialog, Spinner } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { del, errorMessage, get, post } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useAdminAuth } from "@/providers/providers";

type Status = "pending" | "verified" | "unverified" | "rejected" | "suspended" | "deleted" | "all";
type Verification = "unverified" | "pending" | "verified" | "rejected";
type PageBadge = "none" | "verified" | "official" | "partner" | "trusted";
interface Biz {
  id: string; slug: string; name: string; description: string; category: string; website: string | null; verification: Verification; badge: PageBadge; verificationNote: string | null;
  isSuspended: boolean; suspendedReason: string | null; createdAt: string; deletedAt: string | null; ownerUsername: string | null; campaigns: number; balanceMinor: number; spentMinor: number;
}

const VERIFICATION: { v: Verification; label: string; hint: string }[] = [
  { v: "verified", label: "Approved", hint: "Can run ads — its funded campaigns start now" },
  { v: "pending", label: "Under review", hint: "Applied; ads wait" },
  { v: "unverified", label: "Not applied", hint: "Ads wait" },
  { v: "rejected", label: "Rejected", hint: "Ads wait; owner sees your note" },
];
const BADGES: { v: PageBadge; label: string; Icon?: typeof BadgeCheck; cls?: string }[] = [
  { v: "none", label: "No badge" },
  { v: "verified", label: "Verified", Icon: BadgeCheck, cls: "text-sky-500" },
  { v: "official", label: "Official", Icon: Award, cls: "text-amber-500" },
  { v: "partner", label: "Partner", Icon: Handshake, cls: "text-violet-500" },
  { v: "trusted", label: "Trusted", Icon: ShieldCheck, cls: "text-emerald-500" },
];

function BadgeView({ badge }: { badge: PageBadge }) {
  const b = BADGES.find((x) => x.v === badge);
  if (!b?.Icon) return null;
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${b.cls}`}><b.Icon className="size-3.5" /> {b.label}</span>;
}

function StatusDialog({ biz, onClose }: { biz: Biz | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [verification, setVerification] = useState<Verification>(biz?.verification ?? "pending");
  const [badge, setBadge] = useState<PageBadge>(biz?.badge ?? "none");
  const [note, setNote] = useState(biz?.verificationNote ?? "");
  const save = useMutation({
    mutationFn: () => post(`/admin/advertisers/${biz!.id}/status`, { verification, badge, note: note.trim() || undefined }),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["advertisers"] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={!!biz} onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{biz?.name} · status &amp; badge</DialogTitle>
          <DialogDescription>Approving the page starts all its funded campaigns — ads don&apos;t need separate approval. Recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <div className="grid gap-1.5">
            {VERIFICATION.map((o) => (
              <button key={o.v} type="button" onClick={() => setVerification(o.v)} className={`rounded-lg border-2 px-3 py-2 text-left ${verification === o.v ? "border-primary bg-primary/5" : "border-transparent bg-muted/50"}`}>
                <span className="block text-sm font-semibold">{o.label}</span><span className="block text-xs text-muted-foreground">{o.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Badge (shown on the page and its Sponsored posts)</Label>
          <div className="flex flex-wrap gap-1.5">
            {BADGES.map((o) => (
              <button key={o.v} type="button" onClick={() => setBadge(o.v)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${badge === o.v ? "border-primary bg-primary/10" : "hover:bg-accent"}`}>
                {o.Icon && <o.Icon className={`size-4 ${o.cls}`} />} {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note">Note to the owner {verification === "rejected" && "(required)"}</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="min-h-16" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || (verification === "rejected" && note.trim().length < 3)}>{save.isPending && <Spinner />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Erase a page and everything it owns. The admin types the page name to confirm. */
function PurgeDialog({ biz, onClose }: { biz: Biz | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [typed, setTyped] = useState("");
  const purge = useMutation({
    mutationFn: () => del(`/admin/advertisers/${biz!.id}`, { confirmName: typed.trim() }),
    onSuccess: () => { toast.success(`${biz!.name} erased`); qc.invalidateQueries({ queryKey: ["advertisers"] }); qc.invalidateQueries({ queryKey: ["admin-payments"] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={!!biz} onOpenChange={(o) => !o && !purge.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {biz?.name} permanently</DialogTitle>
          <DialogDescription>
            Erases the page and everything in it from the database: campaigns, ads, stats, AI jobs, its balance, its payments and their money records.
            This can&apos;t be undone. It is not a refund — money charged at Stripe stays there, so refund first in Payments if needed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="purge-name">Type <span className="font-semibold">{biz?.name}</span> to confirm</Label>
          <Input id="purge-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={purge.isPending}>Cancel</Button>
          <Button variant="destructive" onClick={() => purge.mutate()} disabled={purge.isPending || typed.trim() !== biz?.name}>{purge.isPending && <Spinner />} Delete permanently</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdvertisersPage() {
  const qc = useQueryClient();
  const { can, isAdmin } = useAdminAuth();
  const manage = can("ads.manage");
  const canPurge = isAdmin && manage;
  const [purging, setPurging] = useState<Biz | null>(null);
  const [status, setStatus] = useState<Status>("pending");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Biz | null>(null);
  const [suspending, setSuspending] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["advertisers", status, search],
    queryFn: () => get<{ items: Biz[] }>(`/admin/advertisers?status=${status}${search ? `&q=${encodeURIComponent(search)}` : ""}`),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["advertisers"] });
  const unsuspend = useMutation({ mutationFn: (id: string) => post(`/admin/advertisers/${id}/suspend`, { suspended: false }), onSuccess: () => { toast.success("Unsuspended — its campaigns resume"); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const label = (v: Verification) => VERIFICATION.find((x) => x.v === v)?.label ?? v;

  return (
    <>
      <PageHeader title="Advertisers" desc="Business pages apply once to run ads. Approve a page and its funded campaigns run straight away (no per-ad approval). Set a badge to show on the page and its Sponsored posts." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }} className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} placeholder="Name or link" className="pl-8" />
        </form>
        <FilterChips<Status> value={status} onChange={setStatus} options={[
          { v: "pending", label: "Applications" }, { v: "verified", label: "Approved" }, { v: "unverified", label: "Not applied" },
          { v: "rejected", label: "Rejected" }, { v: "suspended", label: "Suspended" }, { v: "deleted", label: "Deleted" }, { v: "all", label: "All" },
        ]} />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading && <Spinner className="mx-auto my-10" />}
        {data?.items.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nothing here.</p>}
        <div className="divide-y">
          {data?.items.map((b) => (
            <div key={b.id} className="flex flex-wrap items-start gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{b.name}</span>
                  <BadgeView badge={b.badge} />
                  <span className="text-xs text-muted-foreground">/{b.slug} · {b.category}</span>
                  <Badge variant="outline" className="text-[10px]">{label(b.verification)}</Badge>
                  {b.isSuspended && <Badge className="border-0 bg-destructive/15 text-[10px] text-destructive">suspended</Badge>}
                  {b.deletedAt && <Badge className="border-0 bg-muted text-[10px]">deleted by owner</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  owner @{b.ownerUsername ?? "—"} · {b.campaigns} campaigns · balance {formatMoney(b.balanceMinor)} · spent {formatMoney(b.spentMinor)} · created <Ago date={b.createdAt} />
                </p>
                {b.description && <p className="mt-1 line-clamp-2 text-sm">{b.description}</p>}
                {b.website && <a href={b.website} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="size-3" /> {b.website}</a>}
                {b.verificationNote && <p className="mt-1 text-xs text-muted-foreground">Note: {b.verificationNote}</p>}
                {b.suspendedReason && <p className="mt-1 text-xs text-destructive">Suspended: {b.suspendedReason}</p>}
              </div>
              {manage && (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {!b.deletedAt && <Button size="xs" onClick={() => setEditing(b)}><Pencil /> Status &amp; badge</Button>}
                  {!b.deletedAt && (b.isSuspended
                    ? <Button size="xs" variant="secondary" onClick={() => unsuspend.mutate(b.id)}><ShieldCheck /> Unsuspend</Button>
                    : <Button size="xs" variant="ghost" className="text-destructive" onClick={() => setSuspending(b.id)}><ShieldAlert /> Suspend</Button>)}
                  {canPurge && <Button size="xs" variant="destructive" onClick={() => setPurging(b)}><Trash2 /> Delete permanently</Button>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {editing && <StatusDialog key={editing.id} biz={editing} onClose={() => setEditing(null)} />}
      {purging && <PurgeDialog key={purging.id} biz={purging} onClose={() => setPurging(null)} />}
      <ReasonDialog
        open={!!suspending}
        onOpenChange={(o) => !o && setSuspending(null)}
        title="Suspend business"
        description="All its live campaigns pause immediately. Unsuspending resumes them."
        confirmLabel="Suspend"
        onConfirm={(reason) => post(`/admin/advertisers/${suspending}/suspend`, { suspended: true, reason }).then(() => { toast.success("Suspended"); setSuspending(null); refresh(); }).catch((e) => toast.error(errorMessage(e)))}
      />
    </>
  );
}
