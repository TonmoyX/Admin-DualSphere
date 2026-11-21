"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, ShieldAlert, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Fragment, Suspense, useState } from "react";
import { toast } from "sonner";
import { Ago, humanize, PageHeader, Pagination, Spinner } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, get } from "@/lib/api";
import type { AuditLog } from "@/lib/types";
import { cn } from "@/lib/utils";

const tone = (a: string) =>
  a.includes("IDENTITY") ? "text-warning" : /BAN|DELETE|REMOVE|REUSE|TAMPER|FAILED/.test(a) ? "text-destructive" : /RESTORE|UNBAN|ENABLED/.test(a) ? "text-anon" : "text-foreground";

function AuditInner() {
  const initialAction = useSearchParams().get("action") ?? "all";
  const [action, setAction] = useState(initialAction);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (action !== "all") params.set("action", action);
  if (from) params.set("from", new Date(from).toISOString());
  if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
  const { data, isLoading } = useQuery({
    queryKey: ["audit", params.toString()],
    queryFn: () => get<{ items: AuditLog[]; total: number; actions: string[] }>(`/admin/audit-logs?${params}`),
    placeholderData: keepPreviousData,
  });

  const verify = useMutation({
    mutationFn: () => get<{ ok: boolean; checked: number; brokenAt?: number; reason?: string }>("/admin/audit-logs/verify"),
    onSuccess: (r) =>
      r.ok
        ? toast.success(`Chain intact — ${r.checked.toLocaleString()} records verified`)
        : toast.error(`Tampering detected at record #${r.brokenAt} (${r.reason})`, { duration: 15000 }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Audit log" desc="Append-only. Each record is HMAC-signed and chained to the previous one. The database rejects edits and deletes.">
        <Button variant="outline" onClick={() => verify.mutate()} disabled={verify.isPending}>
          {verify.isPending ? <Spinner /> : <ShieldCheck />} Verify entire chain
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
          <SelectTrigger className="w-60"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {data?.actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" aria-label="From" />
        <span className="text-muted-foreground">→</span>
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" aria-label="To" />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden w-16 sm:table-cell">#</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead className="hidden md:table-cell">Target</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="w-20">Sig</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7}><Spinner className="mx-auto" /></TableCell></TableRow>}
            {data?.items.map((l) => (
              <Fragment key={l.id}>
                <TableRow className="cursor-pointer" onClick={() => setOpen(open === l.id ? null : l.id)}>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">{l.id}</TableCell>
                  <TableCell className={cn("text-xs font-semibold", tone(l.action))}>{humanize(l.action)}</TableCell>
                  <TableCell className="text-sm">{l.actorUsername ? `@${l.actorUsername}` : <span className="text-muted-foreground">system</span>} {l.actorRole && <span className="text-xs text-muted-foreground">({l.actorRole})</span>}</TableCell>
                  <TableCell className="hidden max-w-48 truncate font-mono text-xs text-muted-foreground md:table-cell">{l.targetType}{l.targetId ? `:${l.targetId.slice(0, 8)}…` : ""}</TableCell>
                  <TableCell><Ago date={l.createdAt} /></TableCell>
                  <TableCell>{l.signatureValid ? <ShieldCheck className="size-4 text-anon" aria-label="Valid signature" /> : <ShieldAlert className="size-4 text-destructive" aria-label="Invalid signature" />}</TableCell>
                  <TableCell><ChevronDown className={cn("size-4 transition-transform", open === l.id && "rotate-180")} /></TableCell>
                </TableRow>
                {open === l.id && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={7}>
                      <div className="grid gap-2 text-xs">
                        <div><span className="text-muted-foreground">Target ID:</span> <code className="font-mono">{l.targetId ?? "—"}</code></div>
                        <div><span className="text-muted-foreground">Timestamp:</span> {new Date(l.createdAt).toISOString()}</div>
                        <pre className="overflow-x-auto rounded-lg bg-background p-3 font-mono text-[11px]">{JSON.stringify(l.metadata, null, 2)}</pre>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {data && data.items.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No entries.</TableCell></TableRow>}
          </TableBody>
        </Table>
        {data && <Pagination page={page} total={data.total} limit={50} onPage={setPage} />}
      </div>
    </>
  );
}

export default function AuditPage() {
  return <Suspense><AuditInner /></Suspense>;
}
