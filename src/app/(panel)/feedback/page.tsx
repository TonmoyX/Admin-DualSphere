"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquareWarning, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, FilterChips, MiniAvatar, PageHeader, Pagination, Spinner, StatusPill } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { errorMessage, get, patch } from "@/lib/api";

interface Feedback {
  id: string;
  category: "bug" | "account" | "safety" | "idea" | "other";
  message: string;
  pageUrl: string | null;
  userAgent: string | null;
  status: "new" | "resolved";
  createdAt: string;
  user: { id: string; username: string; displayName: string; avatarUrl: string | null } | null;
}

const LABEL: Record<Feedback["category"], string> = {
  bug: "Something isn't working", account: "Account or login", safety: "Safety or abuse", idea: "Idea or feedback", other: "Other",
};

export default function FeedbackPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"new" | "resolved" | "all">("new");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["feedback", status, page],
    queryFn: () => get<{ items: Feedback[]; total: number }>(`/admin/feedback?status=${status}&page=${page}&limit=20`),
    placeholderData: keepPreviousData,
  });
  const setState = (id: string, s: Feedback["status"]) =>
    patch(`/admin/feedback/${id}`, { status: s })
      .then(() => { toast.success(s === "resolved" ? "Marked resolved" : "Reopened"); qc.invalidateQueries({ queryKey: ["feedback"] }); })
      .catch((e) => toast.error(errorMessage(e)));

  return (
    <>
      <PageHeader title="Feedback" desc="Problems and ideas sent with “Report a problem” (⌘B) on the site.">
        <FilterChips value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ v: "new", label: "New" }, { v: "resolved", label: "Resolved" }, { v: "all", label: "All" }]} />
      </PageHeader>
      {isLoading && <Spinner className="mx-auto mt-10 size-6" />}
      <div className="space-y-3">
        {data?.items.map((f) => (
          <div key={f.id} className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              {f.user ? (
                <span className="flex items-center gap-2 font-medium"><MiniAvatar src={f.user.avatarUrl} name={f.user.displayName} className="size-6" /> @{f.user.username}</span>
              ) : (
                <span className="text-muted-foreground">Deleted user</span>
              )}
              <Badge variant="outline" className={f.category === "safety" ? "border-destructive/40 text-destructive" : ""}>{LABEL[f.category]}</Badge>
              <StatusPill status={f.status === "new" ? "pending" : "reviewed"} />
              <span className="ml-auto"><Ago date={f.createdAt} /></span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{f.message}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {f.pageUrl && <span>Page: <code className="font-mono">{f.pageUrl}</code></span>}
              {f.userAgent && <span className="truncate" title={f.userAgent}>{f.userAgent.slice(0, 80)}</span>}
              <span className="ml-auto">
                {f.status === "new" ? (
                  <Button size="xs" variant="outline" onClick={() => setState(f.id, "resolved")}><Check /> Resolve</Button>
                ) : (
                  <Button size="xs" variant="ghost" onClick={() => setState(f.id, "new")}><RotateCcw /> Reopen</Button>
                )}
              </span>
            </div>
          </div>
        ))}
        {data && data.items.length === 0 && (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <MessageSquareWarning className="mx-auto mb-2 size-8 text-muted-foreground" />
            <p className="font-medium">Nothing here</p>
            <p className="text-sm text-muted-foreground">No {status === "all" ? "" : status} feedback.</p>
          </div>
        )}
      </div>
      {data && data.total > 20 && <div className="mt-4 rounded-xl border bg-card"><Pagination page={page} total={data.total} limit={20} onPage={setPage} /></div>}
    </>
  );
}
