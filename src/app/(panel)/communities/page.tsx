"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, ExternalLink, Globe, Lock, MailCheck, Search, ShieldAlert, ShieldCheck, Star, StarOff, Trash2, Undo2, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, FilterChips, PageHeader, Pagination, ReasonDialog, Spinner, StatusPill } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { del, errorMessage, get, post } from "@/lib/api";
import { useAdminAuth } from "@/providers/providers";
import { PurgeButton } from "@/components/admin/purge";

const FRONTEND = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";

type Status = "all" | "featured" | "private" | "suspended" | "deleted";

interface AdminCommunity {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconUrl: string | null;
  visibility: "public" | "private" | "invite_only";
  anonPolicy: "off" | "allowed" | "anon_only";
  postApproval: boolean;
  memberCount: number;
  postCount: number;
  isFeatured: boolean;
  isSuspended: boolean;
  suspendedReason: string | null;
  deletedAt: string | null;
  createdAt: string;
  owner: { id: string; username: string; displayName: string } | null;
  openReports: number;
}

interface Detail {
  community: AdminCommunity;
  mods: { id: string; username: string; displayName: string; role: "owner" | "mod" }[];
  offenders: { username: string; actions: number }[];
  modLog: { id: number; action: string; reason: string | null; createdAt: string; actor: string | null; target: string | null }[];
}

const VIS = {
  public: { label: "Public", Icon: Globe },
  private: { label: "Private", Icon: Lock },
  invite_only: { label: "Invite only", Icon: MailCheck },
} as const;
const ANON = { off: "Names only", allowed: "Names or anonymous", anon_only: "Anonymous only" } as const;

function DetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { can } = useAdminAuth();
  const manage = can("communities.manage");
  const [dialog, setDialog] = useState<"suspend" | "delete" | "transfer" | null>(null);
  const [newOwner, setNewOwner] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["admin-community", id], queryFn: () => get<Detail>(`/admin/communities/${id}`), enabled: !!id });

  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["admin-community", id] });
    qc.invalidateQueries({ queryKey: ["admin-communities"] });
  };
  const feature = useMutation({
    mutationFn: (featured: boolean) => post(`/admin/communities/${id}/feature`, { featured }),
    onSuccess: (_r, f) => done(f ? "Featured" : "No longer featured"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const unsuspend = useMutation({
    mutationFn: () => post(`/admin/communities/${id}/suspend`, { suspended: false }),
    onSuccess: () => done("Community is active again"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const restore = useMutation({
    mutationFn: () => post(`/admin/communities/${id}/delete`, { deleted: false }),
    onSuccess: () => done("Community restored"),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const c = data?.community;
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{c?.name ?? "Community"}</SheetTitle>
          <SheetDescription>{c ? `c/${c.slug}` : ""}</SheetDescription>
        </SheetHeader>
        {isLoading && <Spinner className="mx-auto my-10" />}
        {c && data && (
          <div className="space-y-6 px-4 pb-6">
            <div className="flex flex-wrap gap-1.5">
              {(() => { const V = VIS[c.visibility]; return <Badge variant="outline"><V.Icon className="size-3" /> {V.label}</Badge>; })()}
              <Badge variant="outline">{ANON[c.anonPolicy]}</Badge>
              {c.postApproval && <Badge variant="outline">Post approval on</Badge>}
              {c.isFeatured && <Badge className="border-0 bg-primary/15 text-primary">Featured</Badge>}
              {c.isSuspended && <StatusPill status="banned" />}
              {c.deletedAt && <StatusPill status="removed" />}
            </div>
            {c.isSuspended && c.suspendedReason && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Suspended: {c.suspendedReason}</p>}
            {c.description && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{c.description}</p>}

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-muted-foreground">Members</dt><dd className="font-semibold tabular-nums">{c.memberCount}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Posts</dt><dd className="font-semibold tabular-nums">{c.postCount}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Open reports</dt><dd className="font-semibold tabular-nums">{c.openReports}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Created</dt><dd><Ago date={c.createdAt} /></dd></div>
            </dl>

            {!c.deletedAt && c.visibility !== "invite_only" && (
              <Button size="sm" variant="outline" asChild>
                <a href={`${FRONTEND}/c/${c.slug}`} target="_blank" rel="noreferrer noopener"><ExternalLink /> Open on site</a>
              </Button>
            )}

            {manage && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Staff actions</h3>
                <p className="text-xs text-muted-foreground">Every action is written to the audit log.</p>
                <div className="flex flex-wrap gap-2">
                  {!c.deletedAt && (
                    c.isFeatured
                      ? <Button size="sm" variant="secondary" onClick={() => feature.mutate(false)} disabled={feature.isPending}><StarOff /> Unfeature</Button>
                      : <Button size="sm" variant="secondary" onClick={() => feature.mutate(true)} disabled={feature.isPending || c.isSuspended || c.visibility === "invite_only"}><Star /> Feature</Button>
                  )}
                  {!c.deletedAt && (
                    c.isSuspended
                      ? <Button size="sm" variant="secondary" onClick={() => unsuspend.mutate()} disabled={unsuspend.isPending}><ShieldCheck /> Unsuspend</Button>
                      : <Button size="sm" variant="secondary" className="text-destructive" onClick={() => setDialog("suspend")}><ShieldAlert /> Suspend</Button>
                  )}
                  {!c.deletedAt && <Button size="sm" variant="secondary" onClick={() => setDialog("transfer")}><Crown /> Transfer ownership</Button>}
                  {c.deletedAt
                    ? <Button size="sm" variant="secondary" onClick={() => restore.mutate()} disabled={restore.isPending}><Undo2 /> Restore</Button>
                    : <Button size="sm" variant="destructive" onClick={() => setDialog("delete")}><Trash2 /> Delete</Button>}
                  {c.deletedAt && (
                    <PurgeButton
                      what={`“${c.name}”`}
                      details="The community, its members and every post in it (with comments, likes and files) are erased."
                      onConfirm={() => del(`/admin/communities/${id}/purge`)}
                      onDone={() => { qc.invalidateQueries({ queryKey: ["admin-communities"] }); onClose(); }}
                    />
                  )}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold">Owner & moderators</h3>
              <ul className="space-y-1 text-sm">
                {data.mods.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    {m.role === "owner" ? <Crown className="size-3.5 text-primary" /> : <ShieldCheck className="size-3.5 text-muted-foreground" />}
                    <span className="font-medium">@{m.username}</span>
                    <span className="text-muted-foreground">{m.displayName}</span>
                  </li>
                ))}
                {data.mods.length === 0 && <li className="text-muted-foreground">No owner — transfer ownership to someone.</li>}
              </ul>
            </section>

            {data.offenders.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-semibold">Repeat offenders here</h3>
                <p className="mb-2 text-xs text-muted-foreground">People community mods removed, muted or banned most. Posting anonymously never counts toward this.</p>
                <ul className="flex flex-wrap gap-1.5">
                  {data.offenders.map((o) => <li key={o.username}><Badge variant="outline">@{o.username} · {o.actions}</Badge></li>)}
                </ul>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold">Community mod log</h3>
              {data.modLog.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
              <ul className="divide-y text-sm">
                {data.modLog.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                    <span className="font-medium">@{e.actor ?? "deleted"}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{e.action}</span>
                    {e.target && <span>→ @{e.target}</span>}
                    {e.reason && <span className="text-muted-foreground">“{e.reason}”</span>}
                    <span className="ml-auto text-xs text-muted-foreground"><Ago date={e.createdAt} /></span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        <ReasonDialog
          open={dialog === "suspend"}
          onOpenChange={(o) => !o && setDialog(null)}
          title={`Suspend ${c?.name ?? ""}`}
          description="Posts are hidden and nobody can post, join or moderate until you unsuspend it. The owner is notified."
          confirmLabel="Suspend"
          onConfirm={(reason) => post(`/admin/communities/${id}/suspend`, { suspended: true, reason }).then(() => { done("Suspended"); setDialog(null); }).catch((e) => toast.error(errorMessage(e)))}
        />
        <ReasonDialog
          open={dialog === "delete"}
          onOpenChange={(o) => !o && setDialog(null)}
          title={`Delete ${c?.name ?? ""}`}
          description="Hides the community and all its posts. Content stays in the database, so you can restore it later."
          confirmLabel="Delete"
          onConfirm={(reason) => post(`/admin/communities/${id}/delete`, { deleted: true, reason }).then(() => { done("Deleted"); setDialog(null); }).catch((e) => toast.error(errorMessage(e)))}
        />
        <ReasonDialog
          open={dialog === "transfer"}
          onOpenChange={(o) => { if (!o) { setDialog(null); setNewOwner(""); } }}
          title="Transfer ownership"
          description="The current owner becomes a moderator. If the new owner isn't a member, they're added."
          confirmLabel="Transfer"
          destructive={false}
          extra={
            <div className="space-y-1.5">
              <Label htmlFor="new-owner">New owner&apos;s username</Label>
              <Input id="new-owner" value={newOwner} onChange={(e) => setNewOwner(e.target.value.replace(/^@/, "").trim())} placeholder="username" />
            </div>
          }
          onConfirm={(reason) =>
            !/^[a-zA-Z0-9_]{3,32}$/.test(newOwner)
              ? void toast.error("Enter a valid username")
              : post(`/admin/communities/${id}/transfer`, { username: newOwner, reason }).then(() => { done(`@${newOwner} now owns it`); setDialog(null); setNewOwner(""); }).catch((e) => toast.error(errorMessage(e)))
          }
        />
      </SheetContent>
    </Sheet>
  );
}

export default function CommunitiesAdminPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("q", search);
  if (status !== "all") params.set("status", status);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-communities", params.toString()],
    queryFn: () => get<{ communities: AdminCommunity[]; total: number }>(`/admin/communities?${params}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Communities" desc="Every community on DualSphere. Community owners and mods never get Admin Panel access, and can't unmask anonymous posts." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPage(1); }} className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} placeholder="Name, link or owner" className="pl-8" />
        </form>
        <FilterChips<Status>
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ v: "all", label: "Active" }, { v: "featured", label: "Featured" }, { v: "private", label: "Private & invite-only" }, { v: "suspended", label: "Suspended" }, { v: "deleted", label: "Deleted" }]}
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading && <Spinner className="mx-auto my-10" />}
        {data?.communities.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No communities here.</p>}
        <div className="divide-y">
          {data?.communities.map((c) => {
            const V = VIS[c.visibility];
            return (
              <button key={c.id} type="button" onClick={() => setOpen(c.id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-accent/40">
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted font-semibold">
                  {c.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.iconUrl} alt="" className="size-full object-cover" />
                  ) : c.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">c/{c.slug}</span>
                    {c.isFeatured && <Badge className="border-0 bg-primary/15 text-[10px] text-primary">Featured</Badge>}
                    {c.isSuspended && <StatusPill status="banned" />}
                    {c.deletedAt && <StatusPill status="removed" />}
                    {c.openReports > 0 && <Badge variant="outline" className="border-warning/40 text-[10px] text-warning">{c.openReports} reports</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><V.Icon className="size-3" /> {V.label}</span>
                    <span className="flex items-center gap-1"><UsersRound className="size-3" /> {c.memberCount}</span>
                    <span>{c.postCount} posts</span>
                    <span>{c.owner ? `owner @${c.owner.username}` : "no owner"}</span>
                    <span>created <Ago date={c.createdAt} /></span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {data && <div className="mt-4"><Pagination page={page} total={data.total} limit={20} onPage={setPage} /></div>}
      <DetailSheet id={open} onClose={() => setOpen(null)} />
    </>
  );
}
