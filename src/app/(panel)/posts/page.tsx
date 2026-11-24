"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Fingerprint, MoreHorizontal, RotateCcw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, FilterChips, humanize, PageHeader, Pagination, ReasonDialog, Spinner, StatusPill, VisibilityPill } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { del, errorMessage, get, post } from "@/lib/api";
import type { AdminPost, Paged } from "@/lib/types";
import { useAdminAuth } from "@/providers/providers";
import { PurgeButton } from "@/components/admin/purge";

const FRONTEND = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";

export default function PostsPage() {
  const { isAdmin, can } = useAdminAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [vis, setVis] = useState<"all" | "identity" | "anonymous">("all");
  const [status, setStatus] = useState<"all" | "live" | "removed" | "flagged" | "reported">("all");
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<AdminPost | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("q", search);
  if (vis !== "all") params.set("visibility", vis);
  if (status !== "all") params.set("status", status);
  const { data, isLoading } = useQuery({ queryKey: ["admin-posts", params.toString()], queryFn: () => get<Paged<AdminPost>>(`/admin/posts?${params}`), placeholderData: keepPreviousData });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-posts"] }); qc.invalidateQueries({ queryKey: ["stats"] }); };

  return (
    <>
      <PageHeader title="Posts" desc="Every post on the platform. Anonymous authors are never shown here." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(q); setPage(1); }} className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search content" className="pl-8" />
        </form>
        <FilterChips value={vis} onChange={(v) => { setVis(v); setPage(1); }} options={[{ v: "all", label: "All" }, { v: "identity", label: "Identity" }, { v: "anonymous", label: "Anonymous" }]} />
        <FilterChips value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[
          { v: "all", label: "Any status" }, { v: "live", label: "Live" }, { v: "removed", label: "Removed" }, { v: "flagged", label: "Flagged" }, { v: "reported", label: "Reported" },
        ]} />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading && <Spinner className="mx-auto my-10" />}
        <div className="divide-y">
          {data?.items.map((p) => (
            <div key={p.id} className="flex gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-sm">
                  <VisibilityPill v={p.visibility} />
                  {p.author ? <span className="font-medium">@{p.author.username}</span> : <span className="text-anon">Anonymous</span>}
                  <StatusPill status={p.isRemoved ? "removed" : "live"} />
                  {p.abuseFlags.map((f) => <Badge key={f} variant="outline" className="border-destructive/40 text-[11px] text-destructive">{humanize(f)}</Badge>)}
                  {p.reportsCount > 0 && <Badge variant="outline" className="border-warning/40 text-[10px] text-warning">{p.reportsCount} reports</Badge>}
                  <span className="ml-auto"><Ago date={p.createdAt} /></span>
                </div>
                <p className="line-clamp-3 text-sm whitespace-pre-wrap">{p.content || <i className="text-muted-foreground">(media only)</i>}</p>
                {p.media.length > 0 && (
                  <div className="mt-2 flex gap-1.5">
                    {p.media.map((m) => m.type === "video"
                      ? <video key={m.url} src={m.url} className="size-16 rounded-md bg-black object-cover" muted />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img key={m.url} src={m.url} alt="" className="size-16 rounded-md object-cover" />)}
                  </div>
                )}
                {p.removedReason && <p className="mt-1.5 text-xs text-destructive">Removed: {p.removedReason}</p>}
                <div className="mt-1.5 text-xs text-muted-foreground">♥ {p.likesCount} · 💬 {p.commentsCount}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="h-fit rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Actions"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild><a href={`${FRONTEND}/post/${p.id}`} target="_blank" rel="noreferrer"><ExternalLink /> View on site</a></DropdownMenuItem>
                  {isAdmin && p.visibility === "anonymous" && (
                    <DropdownMenuItem asChild><Link href={`/identity?post=${p.id}`}><Fingerprint /> Identity lookup…</Link></DropdownMenuItem>
                  )}
                  {can("posts.moderate") && <DropdownMenuSeparator />}
                  {!can("posts.moderate") ? null : p.isRemoved ? (
                    <DropdownMenuItem onClick={() => post(`/moderation/posts/${p.id}/restore`).then(() => { toast.success("Post restored"); refresh(); }).catch((e) => toast.error(errorMessage(e)))}>
                      <RotateCcw /> Restore
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem variant="destructive" onClick={() => setRemoving(p)}><Trash2 /> Remove</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <PurgeButton iconOnly what="this post" details="The post, its comments, likes, tags and photos/videos are erased." onConfirm={() => del(`/moderation/posts/${p.id}/purge`)} onDone={refresh} />
            </div>
          ))}
          {data && data.items.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No posts match.</p>}
        </div>
        {data && <Pagination page={page} total={data.total} limit={20} onPage={setPage} />}
      </div>

      <ReasonDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove post"
        description="The post is hidden from all feeds (soft delete — it can be restored)."
        confirmLabel="Remove post"
        onConfirm={(reason) => del(`/moderation/posts/${removing!.id}`, { reason }).then(() => { toast.success("Post removed"); refresh(); }).catch((e) => toast.error(errorMessage(e)))}
      />
    </>
  );
}
