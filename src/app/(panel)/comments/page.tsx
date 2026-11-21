"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RotateCcw, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, FilterChips, PageHeader, Pagination, ReasonDialog, Spinner, StatusPill } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { del, errorMessage, get, post } from "@/lib/api";
import type { AdminComment, Paged } from "@/lib/types";
import { useAdminAuth } from "@/providers/providers";

const FRONTEND = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";

export default function CommentsPage() {
  const { can } = useAdminAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "live" | "removed">("all");
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: "25" });
  if (search) params.set("q", search);
  if (status !== "all") params.set("status", status);
  const { data, isLoading } = useQuery({ queryKey: ["admin-comments", params.toString()], queryFn: () => get<Paged<AdminComment>>(`/admin/comments?${params}`), placeholderData: keepPreviousData });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-comments"] });

  return (
    <>
      <PageHeader title="Comments" desc="Moderate replies across all posts." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(q); setPage(1); }} className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search comments" className="pl-8" />
        </form>
        <FilterChips value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ v: "all", label: "All" }, { v: "live", label: "Live" }, { v: "removed", label: "Removed" }]} />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comment</TableHead>
              <TableHead className="hidden sm:table-cell">Author</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">When</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5}><Spinner className="mx-auto" /></TableCell></TableRow>}
            {data?.items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="max-w-md"><p className="line-clamp-2 text-sm whitespace-normal">{c.content}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">{c.author ? `@${c.author}` : "Anonymous (post author)"} · {c.isRemoved ? "removed" : "live"}</p></TableCell>
                <TableCell className="hidden text-sm sm:table-cell">{c.author ? `@${c.author}` : <span className="text-anon">Anonymous (post author)</span>}</TableCell>
                <TableCell className="hidden sm:table-cell"><StatusPill status={c.isRemoved ? "removed" : "live"} /></TableCell>
                <TableCell className="hidden md:table-cell"><Ago date={c.createdAt} /></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="icon-sm"><a href={`${FRONTEND}/post/${c.postId}`} target="_blank" rel="noreferrer" aria-label="Open post"><ExternalLink /></a></Button>
                    {!can("comments.moderate") ? null : c.isRemoved ? (
                      <Button variant="ghost" size="icon-sm" aria-label="Restore" onClick={() => post(`/moderation/comments/${c.id}/restore`).then(() => { toast.success("Restored"); refresh(); }).catch((e) => toast.error(errorMessage(e)))}><RotateCcw /></Button>
                    ) : (
                      <Button variant="ghost" size="icon-sm" aria-label="Remove" className="text-destructive" onClick={() => setRemoving(c.id)}><Trash2 /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {data && data.items.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No comments match.</TableCell></TableRow>}
          </TableBody>
        </Table>
        {data && <Pagination page={page} total={data.total} limit={25} onPage={setPage} />}
      </div>
      <ReasonDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove comment"
        confirmLabel="Remove"
        onConfirm={(reason) => del(`/moderation/comments/${removing}`, { reason }).then(() => { toast.success("Comment removed"); refresh(); }).catch((e) => toast.error(errorMessage(e)))}
      />
    </>
  );
}
