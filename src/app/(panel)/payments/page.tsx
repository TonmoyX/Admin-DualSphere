"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, FilterChips, PageHeader, Pagination, ReasonDialog, Spinner } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { del, errorMessage, get, post } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useAdminAuth } from "@/providers/providers";

interface Payment {
  id: string; purpose: string; status: string; amountMinor: number; feeMinor: number; currency: string; provider: string; providerRef: string | null;
  createdAt: string; succeededAt: string | null; releasedAt: string | null; payer: string | null; creator: string | null; business: string | null; refundable: boolean;
}
const PURPOSE: Record<string, string> = { tip: "Tip", unlock: "Paid post", membership: "Membership", ad_topup: "Ad top-up" };

export default function PaymentsPage() {
  const qc = useQueryClient();
  const { isAdmin, can } = useAdminAuth();
  const [status, setStatus] = useState("succeeded");
  const [purpose, setPurpose] = useState("all");
  const [page, setPage] = useState(1);
  const [refunding, setRefunding] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments", status, purpose, page],
    queryFn: () => get<{ items: Payment[]; total: number }>(`/admin/payments?status=${status}&purpose=${purpose}&page=${page}&limit=25`),
    placeholderData: keepPreviousData,
  });
  const canRefund = isAdmin && can("payouts.approve");

  return (
    <>
      <PageHeader title="Payments" desc="Money coming in. Refunds are possible only inside the refund window (before earnings are released) and are admin-only. Delete erases a payment and its money records from the database (not a refund)." />
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChips value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ v: "succeeded", label: "Succeeded" }, { v: "refunded", label: "Refunded" }, { v: "failed", label: "Failed" }, { v: "created", label: "Open" }, { v: "all", label: "All" }]} />
        <FilterChips value={purpose} onChange={(v) => { setPurpose(v); setPage(1); }} options={[{ v: "all", label: "Any" }, { v: "tip", label: "Tips" }, { v: "membership", label: "Memberships" }, { v: "unlock", label: "Paid posts" }, { v: "ad_topup", label: "Ad top-ups" }]} />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading && <Spinner className="mx-auto my-10" />}
        {data?.items.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nothing here.</p>}
        <div className="divide-y">
          {data?.items.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <span className="w-28 font-bold tabular-nums">{formatMoney(p.amountMinor, p.currency)}</span>
              <Badge variant="outline" className="text-[10px]">{PURPOSE[p.purpose] ?? p.purpose}</Badge>
              <Badge variant="outline" className="text-[10px] capitalize">{p.status}</Badge>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                @{p.payer ?? "—"} → {p.creator ? `@${p.creator}` : p.business ?? "—"} · {p.provider} · fee {formatMoney(p.feeMinor, p.currency)}{p.releasedAt ? " · released" : ""}
              </span>
              <span className="text-xs text-muted-foreground"><Ago date={p.createdAt} /></span>
              {canRefund && p.refundable && <Button size="xs" variant="ghost" className="text-destructive" onClick={() => setRefunding(p)}><Undo2 /> Refund</Button>}
              {canRefund && <Button size="xs" variant="destructive" onClick={() => setDeleting(p)}><Trash2 /> Delete</Button>}
            </div>
          ))}
        </div>
        {data && <Pagination page={page} total={data.total} limit={25} onPage={setPage} />}
      </div>
      <ReasonDialog
        open={!!refunding}
        onOpenChange={(o) => !o && setRefunding(null)}
        title={`Refund ${refunding ? formatMoney(refunding.amountMinor, refunding.currency) : ""}`}
        description="Reverses the booking in the ledger (and removes the unlock / shortens the membership). Also return the money in the payment provider's dashboard."
        confirmLabel="Refund"
        onConfirm={(reason) => post(`/admin/payments/${refunding!.id}/refund`, { reason }).then(() => { toast.success("Refunded"); setRefunding(null); qc.invalidateQueries({ queryKey: ["admin-payments"] }); }).catch((e) => toast.error(errorMessage(e)))}
      />
      <ReasonDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting ? formatMoney(deleting.amountMinor, deleting.currency) : ""} payment permanently`}
        description={deleting?.status === "succeeded"
          ? "Erases the payment and its money records from the database, as if it never happened (unlock / membership time / ad balance go with it). This is NOT a refund: the money stays at the provider. Refused if the money was already spent or withdrawn. Can't be undone."
          : "Erases the payment and its money records from the database. Can't be undone."}
        confirmLabel="Delete permanently"
        onConfirm={(reason) => del(`/admin/payments/${deleting!.id}`, { reason }).then(() => { toast.success("Payment deleted"); setDeleting(null); qc.invalidateQueries({ queryKey: ["admin-payments"] }); }).catch((e) => toast.error(errorMessage(e)))}
      />
    </>
  );
}
