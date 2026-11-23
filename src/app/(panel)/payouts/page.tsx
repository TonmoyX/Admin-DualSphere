"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Eye, PauseCircle, PlayCircle, Send, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Ago, FilterChips, PageHeader, ReasonDialog, Spinner } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { del, errorMessage, get, post } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useAdminAuth } from "@/providers/providers";

type Tab = "payouts" | "kyc";
interface Payout {
  id: string; amountMinor: number; currency: string; status: string; createdAt: string; reviewedAt: string | null; providerRef: string | null; rejectReason: string | null;
  methodLabel: string; methodType: string; user: { id: string; username: string; displayName: string }; kycStatus: string | null; needsAdmin: boolean;
  holdReason: string | null; payoutsSuspended: boolean;
}
interface Kyc { userId: string; username: string; displayName: string; legalName: string; idType: string; idLast4: string; status: string; notes: string | null; submittedAt: string; accountCreatedAt: string; payoutsSuspended: boolean }

export default function PayoutsPage() {
  const qc = useQueryClient();
  const { can, isAdmin } = useAdminAuth();
  const approveAllowed = can("payouts.approve");
  const [tab, setTab] = useState<Tab>("payouts");
  const [status, setStatus] = useState("requested");
  const [kycStatus, setKycStatus] = useState("pending");
  const [details, setDetails] = useState<{ payout: Payout; type: string; details: Record<string, string> } | null>(null);
  const [paidRef, setPaidRef] = useState("");
  // Any action that needs a reason: reject, hold, suspend, delete
  const [action, setAction] = useState<{ title: string; description: string; confirm: string; run: (reason: string) => Promise<unknown> } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const payouts = useQuery({ queryKey: ["admin-payouts", status], queryFn: () => get<{ items: Payout[]; total: number }>(`/admin/payouts?status=${status}&limit=50`), enabled: tab === "payouts" });
  const kyc = useQuery({ queryKey: ["admin-kyc", kycStatus], queryFn: () => get<{ items: Kyc[] }>(`/admin/kyc?status=${kycStatus}`), enabled: tab === "kyc" });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-payouts"] }); qc.invalidateQueries({ queryKey: ["admin-kyc"] }); };

  const decide = useMutation({
    mutationFn: ({ id, action, providerRef }: { id: string; action: "approve" | "mark_paid"; providerRef?: string }) => post(`/admin/payouts/${id}`, { action, providerRef }),
    onSuccess: (_r, v) => { toast.success(v.action === "approve" ? "Approved — now send the money and mark it paid" : "Marked as paid"); setDetails(null); setPaidRef(""); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const openDetails = async (p: Payout) => {
    try {
      const d = await get<{ type: string; details: Record<string, string> }>(`/admin/payouts/${p.id}/details`);
      setDetails({ payout: p, ...d });
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const kycDecide = useMutation({
    mutationFn: (userId: string) => post(`/admin/kyc/${userId}`, { approve: true }),
    onSuccess: () => { toast.success("Identity verified"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  // Actions without a reason (release / unsuspend)
  const quick = useMutation({
    mutationFn: ({ url, body }: { url: string; body: Record<string, unknown> }) => post(url, body),
    onSuccess: () => { toast.success("Done"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const ask = (title: string, description: string, confirm: string, run: (reason: string) => Promise<unknown>) => setAction({ title, description, confirm, run });

  const reveal = async (userId: string) => {
    try {
      const r = await get<{ idNumber: string }>(`/admin/kyc/${userId}/reveal`);
      setRevealed((cur) => ({ ...cur, [userId]: r.idNumber }));
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <>
      <PageHeader title="Payouts & KYC" desc="Creators withdraw only after an identity check. Approve, send the bank transfer (US dollars), then mark it paid with the transfer reference. Every step — including viewing account or ID numbers — is in the audit log.">
        <FilterChips<Tab> value={tab} onChange={setTab} options={[{ v: "payouts", label: "Payouts" }, { v: "kyc", label: "Identity checks" }]} />
      </PageHeader>

      {tab === "payouts" && (
        <>
          <div className="mb-3"><FilterChips value={status} onChange={setStatus} options={[{ v: "requested", label: "New" }, { v: "approved", label: "Approved (to send)" }, { v: "on_hold", label: "On hold" }, { v: "paid", label: "Paid" }, { v: "rejected", label: "Rejected" }, { v: "all", label: "All" }]} /></div>
          <div className="overflow-hidden rounded-xl border bg-card">
            {payouts.isLoading && <Spinner className="mx-auto my-10" />}
            {payouts.data?.items.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nothing here.</p>}
            <div className="divide-y">
              {payouts.data?.items.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-lg font-bold tabular-nums">{formatMoney(p.amountMinor, p.currency)}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{p.status.replace("_", " ")}</Badge>
                      {p.needsAdmin && <Badge className="border-0 bg-warning/15 text-[10px] text-warning">admin approval</Badge>}
                      {p.payoutsSuspended && <Badge className="border-0 bg-destructive/15 text-[10px] text-destructive">payouts suspended</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">@{p.user.username} ({p.user.displayName}) → {p.methodLabel} · KYC {p.kycStatus ?? "—"} · <Ago date={p.createdAt} /></p>
                    {p.providerRef && <p className="text-xs">Ref: {p.providerRef}</p>}
                    {p.rejectReason && <p className="text-xs text-destructive">{p.rejectReason}</p>}
                    {p.holdReason && <p className="text-xs text-warning">On hold: {p.holdReason}</p>}
                  </div>
                  {approveAllowed && (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {p.status === "requested" && <Button size="xs" disabled={(p.needsAdmin && !isAdmin) || decide.isPending || p.payoutsSuspended} onClick={() => decide.mutate({ id: p.id, action: "approve" })}><CheckCircle2 /> Approve</Button>}
                      {p.status === "approved" && <Button size="xs" disabled={(p.needsAdmin && !isAdmin) || p.payoutsSuspended} onClick={() => openDetails(p)}><Send /> Send & mark paid</Button>}
                      {(p.status === "requested" || p.status === "approved") && (
                        <Button size="xs" variant="secondary" onClick={() => ask("Put payout on hold", "The payout pauses; the money stays reserved until you release it. The creator sees your reason.", "Hold", (reason) => post(`/admin/payouts/${p.id}/hold`, { hold: true, reason }))}><PauseCircle /> Hold</Button>
                      )}
                      {p.status === "on_hold" && <Button size="xs" variant="secondary" disabled={quick.isPending} onClick={() => quick.mutate({ url: `/admin/payouts/${p.id}/hold`, body: { hold: false } })}><PlayCircle /> Release</Button>}
                      {(p.status === "requested" || p.status === "approved" || p.status === "on_hold") && (
                        <Button size="xs" variant="ghost" className="text-destructive" onClick={() => ask("Reject payout", "The money goes back to the creator's available balance.", "Reject", (reason) => post(`/admin/payouts/${p.id}`, { action: "reject", reason }))}><XCircle /> Reject</Button>
                      )}
                      {p.payoutsSuspended
                        ? <Button size="xs" variant="ghost" disabled={quick.isPending} onClick={() => quick.mutate({ url: `/admin/creators/${p.user.id}/payouts-suspend`, body: { suspended: false } })}><ShieldCheck /> Unsuspend payouts</Button>
                        : <Button size="xs" variant="ghost" className="text-destructive" onClick={() => ask(`Suspend payouts for @${p.user.username}`, "No new payout requests or approvals for this creator; their open payouts go on hold.", "Suspend", (reason) => post(`/admin/creators/${p.user.id}/payouts-suspend`, { suspended: true, reason }))}><Ban /> Suspend payouts</Button>}
                      <Button size="xs" variant="destructive" onClick={() => ask("Delete payout permanently", p.status === "paid" ? "Erases this payout record from the database. The money was really sent, so the books keep that it left. Can't be undone." : p.status === "rejected" ? "Erases this rejected payout and its money records from the database. Can't be undone." : "Cancels the payout (money back to the creator's balance) and erases it and its money records from the database. Can't be undone.", "Delete", (reason) => del(`/admin/payouts/${p.id}`, { reason }))}><Trash2 /> Delete</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "kyc" && (
        <>
          <div className="mb-3"><FilterChips value={kycStatus} onChange={setKycStatus} options={[{ v: "pending", label: "Waiting" }, { v: "verified", label: "Verified" }, { v: "on_hold", label: "On hold" }, { v: "suspended", label: "Suspended" }, { v: "rejected", label: "Rejected" }, { v: "all", label: "All" }]} /></div>
          <div className="overflow-hidden rounded-xl border bg-card">
            {kyc.isLoading && <Spinner className="mx-auto my-10" />}
            {kyc.data?.items.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nothing here.</p>}
            <div className="divide-y">
              {kyc.data?.items.map((k) => (
                <div key={k.userId} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{k.legalName} <span className="text-xs text-muted-foreground">@{k.username} · account <Ago date={k.accountCreatedAt} /></span></p>
                    <p className="text-xs text-muted-foreground">
                      {k.idType.replace("_", " ")} · {revealed[k.userId] ? <span className="font-mono text-foreground">{revealed[k.userId]}</span> : `•••• ${k.idLast4}`} · submitted <Ago date={k.submittedAt} /> · <span className="capitalize">{k.status.replace("_", " ")}</span>{k.payoutsSuspended && <span className="text-destructive"> · payouts suspended</span>}
                    </p>
                    {k.notes && <p className="text-xs text-destructive">{k.notes}</p>}
                  </div>
                  {approveAllowed && (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {!revealed[k.userId] && <Button size="xs" variant="ghost" onClick={() => reveal(k.userId)}><Eye /> Show ID (logged)</Button>}
                      {k.status === "pending" && <Button size="xs" onClick={() => kycDecide.mutate(k.userId)} disabled={kycDecide.isPending}><ShieldCheck /> Verify</Button>}
                      {k.status === "pending" && <Button size="xs" variant="ghost" className="text-destructive" onClick={() => ask("Reject identity check", "Tell the creator what to fix.", "Reject", (reason) => post(`/admin/kyc/${k.userId}`, { approve: false, notes: reason }))}><XCircle /> Reject</Button>}
                      {(k.status === "pending" || k.status === "verified") && (
                        <Button size="xs" variant="secondary" onClick={() => ask("Put identity check on hold", "Payouts are blocked while it's on hold; open payouts pause. Release returns it to its previous status.", "Hold", (reason) => post(`/admin/kyc/${k.userId}/hold`, { hold: true, reason }))}><PauseCircle /> Hold</Button>
                      )}
                      {k.status === "on_hold" && <Button size="xs" variant="secondary" disabled={quick.isPending} onClick={() => quick.mutate({ url: `/admin/kyc/${k.userId}/hold`, body: { hold: false } })}><PlayCircle /> Release</Button>}
                      {k.status === "suspended"
                        ? <Button size="xs" variant="ghost" disabled={quick.isPending} onClick={() => quick.mutate({ url: `/admin/kyc/${k.userId}/suspend`, body: { suspended: false } })}><ShieldCheck /> Unsuspend</Button>
                        : <Button size="xs" variant="ghost" className="text-destructive" onClick={() => ask("Suspend identity verification", "The verification is revoked: no payouts until you unsuspend it. Open payouts go on hold.", "Suspend", (reason) => post(`/admin/kyc/${k.userId}/suspend`, { suspended: true, reason }))}><Ban /> Suspend</Button>}
                      <Button size="xs" variant="destructive" onClick={() => ask("Delete identity check", "Removes the record; the creator must submit again before any payout. Not allowed while a payout is in progress.", "Delete", (reason) => del(`/admin/kyc/${k.userId}`, { reason }))}><Trash2 /> Delete</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Dialog open={!!details} onOpenChange={(o) => !o && !decide.isPending && setDetails(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send {details ? formatMoney(details.payout.amountMinor, details.payout.currency) : ""}</DialogTitle>
            <DialogDescription>Send the money from the {details?.type} dashboard, then enter the transfer reference. Viewing these details was logged.</DialogDescription>
          </DialogHeader>
          {details && (
            <dl className="grid grid-cols-[120px_1fr] gap-y-1 rounded-lg bg-muted p-3 text-sm">
              {Object.entries(details.details).filter(([, v]) => v).map(([k, v]) => (<Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-mono">{v}</dd></Fragment>))}
            </dl>
          )}
          <Input value={paidRef} onChange={(e) => setPaidRef(e.target.value)} placeholder="Transfer / transaction ID" maxLength={100} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetails(null)}>Cancel</Button>
            <Button disabled={paidRef.trim().length < 4 || decide.isPending} onClick={() => details && decide.mutate({ id: details.payout.id, action: "mark_paid", providerRef: paidRef.trim() })}>{decide.isPending && <Spinner />} Mark paid</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReasonDialog
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
        title={action?.title ?? ""}
        description={action?.description}
        confirmLabel={action?.confirm ?? "Confirm"}
        onConfirm={(reason) => action!.run(reason).then(() => { toast.success("Done"); setAction(null); refresh(); }).catch((e) => toast.error(errorMessage(e)))}
      />
    </>
  );
}
