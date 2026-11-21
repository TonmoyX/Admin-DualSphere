"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bot, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, humanize, MiniAvatar, PageHeader, ReasonDialog, Spinner, StatusPill, VisibilityPill } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { del, errorMessage, get } from "@/lib/api";

interface Flags {
  users: { id: string; username: string; displayName: string; avatarUrl: string | null; abuseScore: number; isBanned: boolean; postCount: number; createdAt: string }[];
  posts: { id: string; content: string; visibility: "identity" | "anonymous"; abuseFlags: string[]; reportsCount: number; isRemoved: boolean; createdAt: string; author: string | null }[];
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
  const [removing, setRemoving] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["abuse"], queryFn: () => get<Flags>("/admin/abuse-flags") });

  return (
    <>
      <PageHeader title="Abuse detection" desc="Signals raised automatically: duplicate detection, spam heuristics, and posting-velocity scoring." />
      {isLoading && <Spinner className="mx-auto mt-10 size-6" />}
      {data && (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bot className="size-4" /> Users by abuse score</CardTitle>
              <CardDescription>Accumulated from identity activity only.</CardDescription>
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
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4" /> Flagged posts</CardTitle>
              <CardDescription>Anonymous posts stay anonymous here. Use the identity lookup if action against the author is required.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.posts.length === 0 && <p className="text-sm text-muted-foreground">No flagged posts. 🎉</p>}
              {data.posts.map((p) => (
                <div key={p.id} className="rounded-lg border p-3">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <VisibilityPill v={p.visibility} />
                    {p.author ? <span>@{p.author}</span> : <span className="text-anon">Anonymous</span>}
                    {p.isRemoved && <StatusPill status="removed" />}
                    <span className="ml-auto"><Ago date={p.createdAt} /></span>
                  </div>
                  <p className="line-clamp-2 text-sm">{p.content}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {p.abuseFlags.map((f) => <Badge key={f} variant="outline" title={FLAG_INFO[f]} className="border-destructive/40 text-[11px] text-destructive">{humanize(f)}</Badge>)}
                    {!p.isRemoved && <Button size="xs" variant="ghost" className="ml-auto text-destructive" onClick={() => setRemoving(p.id)}><Trash2 /> Remove</Button>}
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
        onConfirm={(reason) => del(`/moderation/posts/${removing}`, { reason }).then(() => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["abuse"] }); }).catch((e) => toast.error(errorMessage(e)))}
      />
    </>
  );
}
