"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bot, CheckCircle2, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, FilterChips, humanize, MiniAvatar, PageHeader, ReasonDialog, Spinner, StatusPill, VisibilityPill } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { del, errorMessage, get, patch, post } from "@/lib/api";
import { useAdminAuth } from "@/providers/providers";
import { PurgeButton } from "@/components/admin/purge";

type Status = "open" | "resolved";

interface FlaggedPost {
  id: string;
  content: string;
  visibility: "identity" | "anonymous";
  abuseFlags: string[];
  reportsCount: number;
  isRemoved: boolean;
  createdAt: string;
  author: string | null;
  resolution: "dismissed" | "removed" | "deleted" | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

interface Flags {
  users: { id: string; username: string; displayName: string; avatarUrl: string | null; abuseScore: number; isBanned: boolean; postCount: number; createdAt: string }[];
  posts: FlaggedPost[];
}

const FLAG_INFO: Record<string, string> = {
  "duplicate:similar": "Near-duplicate of a recent post (Levenshtein)",
  "spam:links": "3+ links",
  "spam:caps": "Mostly uppercase",
  "spam:repeat": "Repeated characters",
  "spam:keyword": "Contains a banned word",
  "bot:velocity": "Posting very fast (>8 in 10 min)",
  "bot:fast": "Posting fast (>5 in 10 min)",
};

export default function AbusePage() {
  const qc = useQueryClient();
  const { can } = useAdminAuth();
  const [status, setStatus] = useState<Status>("open");
  const [removing, setRemoving] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["abuse", status], queryFn: () => get<Flags>(`/admin/abuse-flags?status=${status}`) });

  // Refresh both tabs and the sidebar counter after any decision
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["abuse"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  };

  const dismiss = useMutation({
    mutationFn: (id: string) => post(`/admin/abuse-flags/posts/${id}/dismiss`),
    onSuccess: () => { toast.success("Flag dismissed"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reopen = useMutation({
    mutationFn: (id: string) => post(`/admin/abuse-flags/posts/${id}/reopen`),
    onSuccess: () => { toast.success("Flag reopened"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const restore = useMutation({
    mutationFn: (id: string) => post(`/moderation/posts/${id}/restore`),
    onSuccess: () => { toast.success("Post restored"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const resetScore = useMutation({
    mutationFn: (id: string) => patch(`/admin/users/${id}`, { resetAbuseScore: true }),
    onSuccess: () => { toast.success("Abuse score reset"); refresh(); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const canModerate = can("posts.moderate");
  const busy = (id: string) =>
    (dismiss.isPending && dismiss.variables === id) || (reopen.isPending && reopen.variables === id) || (restore.isPending && restore.variables === id);

  return (
    <>
      <PageHeader title="Abuse detection" desc="Signals raised automatically: duplicate detection, spam heuristics, and posting-velocity scoring." />
      {isLoading && !data && <Spinner className="mx-auto mt-10 size-6" />}
      {data && (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Card className="self-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bot className="size-4" /> Users by abuse score</CardTitle>
              <CardDescription>Accumulated from identity activity only. Reset a score once you&apos;ve looked into it.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {data.users.length === 0 && <p className="py-4 text-sm text-muted-foreground">No flagged users.</p>}
              {data.users.map((u) => (
                <div key={u.id} className="flex items-center gap-2.5 py-2.5">
                  <MiniAvatar src={u.avatarUrl} name={u.displayName} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">@{u.username}</div>
                    <div className="text-xs text-muted-foreground">{u.postCount} posts · joined <Ago date={u.createdAt} /></div>
                  </div>
                  {u.isBanned && <StatusPill status="banned" />}
                  <span className="font-heading text-lg font-bold text-destructive tabular-nums">{u.abuseScore}</span>
                  {can("users.manage") && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      title="Reset abuse score"
                      aria-label={`Reset abuse score for @${u.username}`}
                      disabled={resetScore.isPending && resetScore.variables === u.id}
                      onClick={() => resetScore.mutate(u.id)}
                    >
                      <RotateCcw />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4" /> Flagged posts</CardTitle>
                <FilterChips<Status> value={status} onChange={setStatus} options={[{ v: "open", label: "Needs review" }, { v: "resolved", label: "Resolved" }]} />
              </div>
              <CardDescription>
                {status === "open"
                  ? "Decide on each one: dismiss if it looks fine, or remove it. Anonymous posts stay anonymous here — use the identity lookup if action against the author is required."
                  : "Flags that were dismissed, or whose post was removed or deleted."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.posts.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {status === "open" ? "Nothing needs review. 🎉" : "No resolved flags yet."}
                </p>
              )}
              {data.posts.map((p) => (
                <div key={p.id} className="rounded-lg border p-3">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <VisibilityPill v={p.visibility} />
                    {p.author && <span>@{p.author}</span>}
                    {p.resolution && <StatusPill status={p.resolution} />}
                    {p.reportsCount > 0 && <span className="text-muted-foreground">· {p.reportsCount} report{p.reportsCount === 1 ? "" : "s"}</span>}
                    <span className="ml-auto text-muted-foreground"><Ago date={p.createdAt} /></span>
                  </div>
                  <p className="line-clamp-3 text-sm">{p.content || <span className="text-muted-foreground italic">(no text)</span>}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {p.abuseFlags.map((f) => <Badge key={f} variant="outline" title={FLAG_INFO[f]} className="border-destructive/40 text-[11px] text-destructive">{humanize(f)}</Badge>)}
                    {status === "resolved" && p.reviewedAt && (
                      <span className="text-xs text-muted-foreground">
                        Reviewed <Ago date={p.reviewedAt} />{p.reviewedBy ? ` by @${p.reviewedBy}` : ""}
                      </span>
                    )}

                    {canModerate && (
                      <div className="ml-auto flex items-center gap-1">
                        {status === "open" && (
                          <>
                            <Button size="xs" variant="ghost" disabled={busy(p.id)} onClick={() => dismiss.mutate(p.id)}>
                              <CheckCircle2 /> Dismiss
                            </Button>
                            <Button size="xs" variant="ghost" className="text-destructive" disabled={busy(p.id)} onClick={() => setRemoving(p.id)}>
                              <Trash2 /> Remove
                            </Button>
                          </>
                        )}
                        {status === "resolved" && p.resolution === "dismissed" && (
                          <Button size="xs" variant="ghost" disabled={busy(p.id)} onClick={() => reopen.mutate(p.id)}>
                            <Undo2 /> Reopen
                          </Button>
                        )}
                        {status === "resolved" && p.resolution === "removed" && (
                          <Button size="xs" variant="ghost" disabled={busy(p.id)} onClick={() => restore.mutate(p.id)}>
                            <RotateCcw /> Restore post
                          </Button>
                        )}
                        <PurgeButton
                          size="xs"
                          label="Delete"
                          what="this post"
                          details="The post, its comments, likes and photos/videos are erased."
                          onConfirm={() => del(`/moderation/posts/${p.id}/purge`)}
                          onDone={refresh}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
      <ReasonDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove flagged post"
        confirmLabel="Remove"
        onConfirm={(reason) => del(`/moderation/posts/${removing}`, { reason }).then(() => { toast.success("Removed"); refresh(); }).catch((e) => toast.error(errorMessage(e)))}
      />
    </>
  );
}
