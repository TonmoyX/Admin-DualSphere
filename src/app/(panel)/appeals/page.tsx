"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Scale, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, FilterChips, MiniAvatar, PageHeader, Pagination, Spinner, StatusPill } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { del, errorMessage, get, post } from "@/lib/api";
import { PurgeButton } from "@/components/admin/purge";

interface Appeal {
  id: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  response: string | null;
  createdAt: string;
  reviewedAt: string | null;
  banReason: string | null;
  bannedUntil: string | null;
  stillBanned: boolean;
  reviewer: string | null;
  user: { id: string; username: string; displayName: string; avatarUrl: string | null; joinedAt: string; postCount: number; abuseScore: number };
}
type Status = "pending" | "approved" | "rejected" | "all";
const FRONTEND = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";

export default function AppealsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("pending");
  const [page, setPage] = useState(1);
  const [deciding, setDeciding] = useState<{ appeal: Appeal; decision: "approve" | "reject" } | null>(null);
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["appeals", status, page],
    queryFn: () => get<{ items: Appeal[]; total: number }>(`/moderation/appeals?status=${status}&page=${page}&limit=20`),
    placeholderData: keepPreviousData,
  });

  const decide = async () => {
    if (!deciding) return;
    setBusy(true);
    try {
      await post(`/moderation/appeals/${deciding.appeal.id}`, { decision: deciding.decision, response: response.trim() || undefined });
      toast.success(deciding.decision === "approve" ? `@${deciding.appeal.user.username} is restored` : "Appeal declined");
      qc.invalidateQueries({ queryKey: ["appeals"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      setDeciding(null);
      setResponse("");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Ban appeals" desc="Suspended people asking for a review from their suspension page. Approving lifts the ban.">
        <FilterChips
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ v: "pending", label: "Pending" }, { v: "approved", label: "Approved" }, { v: "rejected", label: "Declined" }, { v: "all", label: "All" }]}
        />
      </PageHeader>
      {isLoading && <Spinner className="mx-auto mt-10 size-6" />}

      <div className="space-y-3">
        {data?.items.map((a) => (
          <div key={a.id} className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <a href={`${FRONTEND}/profile/${a.user.username}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-medium hover:underline">
                <MiniAvatar src={a.user.avatarUrl} name={a.user.displayName} className="size-7" />
                {a.user.displayName} <span className="text-muted-foreground">@{a.user.username}</span>
              </a>
              <StatusPill status={a.status} />
              <span className="order-last">
                <PurgeButton iconOnly what="this appeal" details="Only the review request is erased — the ban itself doesn't change." onConfirm={() => del(`/moderation/appeals/${a.id}`)} onDone={() => qc.invalidateQueries({ queryKey: ["appeals"] })} />
              </span>
              {!a.stillBanned && a.status !== "approved" && <Badge variant="outline">No longer banned</Badge>}
              <span className="ml-auto text-xs text-muted-foreground"><Ago date={a.createdAt} /></span>
            </div>

            <div className="mb-3 grid gap-1 rounded-lg bg-muted/60 p-3 text-xs sm:grid-cols-2">
              <span><span className="text-muted-foreground">Ban reason: </span><span className="font-medium">{a.banReason ?? "—"}</span></span>
              <span><span className="text-muted-foreground">Duration: </span><span className="font-medium">{a.bannedUntil ? `until ${new Date(a.bannedUntil).toLocaleString()}` : "Permanent"}</span></span>
              <span><span className="text-muted-foreground">Joined: </span>{new Date(a.user.joinedAt).toLocaleDateString()} · {a.user.postCount} posts</span>
              <span><span className="text-muted-foreground">Abuse score: </span><span className={a.user.abuseScore > 30 ? "font-semibold text-destructive" : ""}>{a.user.abuseScore}</span></span>
            </div>

            <p className="text-sm whitespace-pre-wrap">{a.message}</p>

            {a.status !== "pending" && (
              <p className="mt-3 border-t pt-3 text-sm">
                <span className="text-muted-foreground">{a.status === "approved" ? "Approved" : "Declined"}{a.reviewer ? ` by @${a.reviewer}` : ""}{a.reviewedAt ? <> · <Ago date={a.reviewedAt} /></> : null}: </span>
                {a.response}
              </p>
            )}

            {a.status === "pending" && (
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setDeciding({ appeal: a, decision: "reject" })}><X /> Decline</Button>
                <Button size="sm" onClick={() => setDeciding({ appeal: a, decision: "approve" })}><Check /> Approve & unban</Button>
              </div>
            )}
          </div>
        ))}
        {data && data.items.length === 0 && (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <Scale className="mx-auto mb-2 size-8 text-muted-foreground" />
            <p className="font-medium">Nothing here</p>
            <p className="text-sm text-muted-foreground">No {status === "all" ? "" : status === "rejected" ? "declined" : status} appeals.</p>
          </div>
        )}
      </div>
      {data && data.total > 20 && <div className="mt-4 rounded-xl border bg-card"><Pagination page={page} total={data.total} limit={20} onPage={setPage} /></div>}

      <Dialog open={!!deciding} onOpenChange={(o) => { if (!o) { setDeciding(null); setResponse(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deciding?.decision === "approve" ? `Restore @${deciding.appeal.user.username}?` : "Decline this appeal?"}</DialogTitle>
            <DialogDescription>
              {deciding?.decision === "approve"
                ? "The ban is lifted right away and they can use their account again."
                : "The suspension stays. They can ask again in 7 days."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="appeal-response">Message to the user (optional)</Label>
            <Textarea
              id="appeal-response"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              maxLength={1000}
              placeholder={deciding?.decision === "approve" ? "Your account has been restored." : "After review, the suspension stays in place."}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeciding(null)}>Cancel</Button>
            <Button variant={deciding?.decision === "approve" ? "default" : "destructive"} disabled={busy} onClick={decide}>
              {busy && <Spinner />} {deciding?.decision === "approve" ? "Approve & unban" : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
