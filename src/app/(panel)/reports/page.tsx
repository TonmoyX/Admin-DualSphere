"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Check, ExternalLink, Fingerprint, Flag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, FilterChips, PageHeader, Pagination, Spinner, StatusPill, VisibilityPill } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage, get, patch } from "@/lib/api";
import type { Paged, Report } from "@/lib/types";
import { useAdminAuth } from "@/providers/providers";

const FRONTEND = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";
type Status = "pending" | "actioned" | "dismissed" | "reviewed" | "all";
type Action = { status: "reviewed" | "actioned" | "dismissed"; action: "none" | "remove_content" | "ban_author" };

function ReportCard({ r }: { r: Report }) {
  const { isAdmin, can } = useAdminAuth();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: (a: Action) => patch(`/moderation/reports/${r.id}`, { ...a, note: note || undefined, applyToAll: true }),
    onSuccess: () => {
      toast.success("Report resolved");
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const postId = r.targetType === "post" ? r.targetId : r.target.postId;
  const anonPost = r.targetType === "post" && r.target.visibility === "anonymous";
  const isUser = r.targetType === "user";

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Flag className="size-4 text-warning" />
        <Badge variant="outline" className="capitalize">{r.reason}</Badge>
        <span className="text-muted-foreground">{isUser ? "profile" : r.targetType} reported by <b className="text-foreground">@{r.reporter}</b></span>
        <StatusPill status={r.status} />
        <span className="ml-auto"><Ago date={r.createdAt} /></span>
      </div>
      {r.details && <p className="mb-3 rounded-lg bg-muted/50 px-3 py-2 text-sm italic">“{r.details}”</p>}

      <div className="rounded-lg border-l-2 border-warning/50 bg-background/50 p-3">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {isUser && <Badge variant="outline" className="text-[10px]">Profile</Badge>}
          {r.targetType === "message" && <Badge variant="outline" className="text-[10px]">Private message · only this message is visible</Badge>}
          {r.target.visibility && <VisibilityPill v={r.target.visibility} />}
          {r.target.author ? <span>by @{r.target.author}</span> : <span className="text-anon">Anonymous author</span>}
          {r.target.isRemoved && <StatusPill status={isUser ? "banned" : "removed"} />}
          {!!r.target.reportsCount && <span>{r.target.reportsCount} total reports</span>}
        </div>
        <p className="text-sm whitespace-pre-wrap">{r.target.content ?? <i className="text-muted-foreground">Content deleted</i>}</p>
        {r.target.media && r.target.media.length > 0 && (
          <div className="mt-2 flex gap-1.5">
            {r.target.media.map((m) => m.type === "video"
              ? <video key={m.url} src={m.url} className="size-20 rounded-md bg-black object-cover" controls />
              // eslint-disable-next-line @next/next/no-img-element
              : <img key={m.url} src={m.url} alt="" className="size-20 rounded-md object-cover" />)}
          </div>
        )}
      </div>

      {r.status === "pending" && can("reports.resolve") ? (
        <div className="mt-3 space-y-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note (optional, audit-logged)" maxLength={500} />
          <div className="flex flex-wrap gap-2">
            {!isUser && can("posts.moderate") && can("comments.moderate") && <Button size="sm" variant="destructive" disabled={m.isPending} onClick={() => m.mutate({ status: "actioned", action: "remove_content" })}><Trash2 /> Remove content</Button>}
            {!anonPost && can("users.ban") && (
              <Button size="sm" variant="destructive" disabled={m.isPending} onClick={() => m.mutate({ status: "actioned", action: "ban_author" })}><Ban /> {isUser ? "Ban account" : "Ban author"}</Button>
            )}
            <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate({ status: "reviewed", action: "none" })}><Check /> Mark reviewed</Button>
            <Button size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate({ status: "dismissed", action: "none" })}><X /> Dismiss</Button>
            <div className="ml-auto flex gap-1">
              {anonPost && isAdmin && <Button asChild size="sm" variant="ghost"><Link href={`/identity?post=${r.targetId}`}><Fingerprint /> Lookup</Link></Button>}
              {isUser && r.target.profile && <Button asChild size="sm" variant="ghost"><a href={`${FRONTEND}/profile/${r.target.profile}`} target="_blank" rel="noreferrer"><ExternalLink /> Open profile</a></Button>}
              {postId && <Button asChild size="sm" variant="ghost"><a href={`${FRONTEND}/post/${postId}`} target="_blank" rel="noreferrer"><ExternalLink /> Open</a></Button>}
            </div>
          </div>
        </div>
      ) : r.status === "pending" ? (
        <p className="mt-3 text-xs text-muted-foreground">Waiting for review — you can view reports but not resolve them.</p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Resolved by @{r.reviewer ?? "system"} <Ago date={r.reviewedAt} />{r.resolutionNote ? ` — “${r.resolutionNote}”` : ""}
        </p>
      )}
    </motion.div>
  );
}

export default function ReportsPage() {
  const [status, setStatus] = useState<Status>("pending");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["reports", status, page],
    queryFn: () => get<Paged<Report>>(`/moderation/reports?status=${status}&page=${page}&limit=20`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Report queue" desc="Resolving a report also resolves other pending reports on the same content.">
        <FilterChips value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[
          { v: "pending", label: "Pending" }, { v: "actioned", label: "Actioned" }, { v: "reviewed", label: "Reviewed" }, { v: "dismissed", label: "Dismissed" }, { v: "all", label: "All" },
        ]} />
      </PageHeader>
      {isLoading && <Spinner className="mx-auto mt-10 size-6" />}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {data?.items.map((r) => <ReportCard key={r.id} r={r} />)}
        </AnimatePresence>
        {data && data.items.length === 0 && (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <Check className="mx-auto mb-2 size-8 text-anon" />
            <p className="font-medium">Queue is clear</p>
            <p className="text-sm text-muted-foreground">No {status === "all" ? "" : status} reports.</p>
          </div>
        )}
      </div>
      {data && data.total > 20 && <div className="mt-4 rounded-xl border bg-card"><Pagination page={page} total={data.total} limit={20} onPage={setPage} /></div>}
    </>
  );
}
