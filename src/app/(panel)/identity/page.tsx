"use client";

import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, Fingerprint, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Ago, PageHeader, RolePill, Spinner, StatusPill } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, post } from "@/lib/api";
import { useAdminAuth } from "@/providers/providers";

interface LookupResult {
  postId: string;
  integrity: "verified";
  user: { id: string; username: string; displayName: string; email: string; role: string; isBanned: boolean; abuseScore: number; createdAt: string } | null;
}

function IdentityInner() {
  const { me } = useAdminAuth();
  const initial = useSearchParams().get("post") ?? "";
  const [postId, setPostId] = useState(initial);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [ack, setAck] = useState(false);

  const m = useMutation({
    mutationFn: () => post<LookupResult>(`/admin/identity/${postId.trim()}`, { reason, mfaCode: code || undefined }),
  });

  const valid = /^[0-9a-f-]{36}$/i.test(postId.trim()) && reason.trim().length >= 10 && ack && (!me?.mfaEnabled || code.length === 6);

  return (
    <>
      <PageHeader title="Identity lookup" desc="De-anonymise the author of an anonymous post. This is the most sensitive action on the platform." />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {!me?.mfaEnabled && (
            <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <b className="text-warning">Two-factor authentication required.</b>{" "}
                <span className="text-muted-foreground">Identity lookups require 2FA on your account (configurable in Site settings → Moderation).</span>{" "}
                <Link href="/account" className="text-primary hover:underline">Enable 2FA →</Link>
              </div>
            </div>
          )}

          <form
            className="space-y-4 rounded-xl border bg-card p-5"
            onSubmit={(e) => { e.preventDefault(); if (valid) m.mutate(); }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="pid">Anonymous post ID</Label>
              <Input id="pid" value={postId} onChange={(e) => setPostId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="why">Legal / policy justification</Label>
              <Textarea id="why" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="min-h-24" placeholder="e.g. Law-enforcement request #1234 regarding credible threat of violence (min 10 characters)" />
            </div>
            {me?.mfaEnabled && (
              <div className="space-y-1.5">
                <Label htmlFor="code">Authenticator code</Label>
                <Input id="code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-40 text-center font-mono tracking-widest" placeholder="000000" />
              </div>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 accent-[var(--warning)]" />
              <span className="text-muted-foreground">I understand this lookup is permanently recorded in the signed audit log with my identity, the reason and a timestamp, and is visible to all admins.</span>
            </label>
            {m.isError && <p className="text-sm text-destructive">{errorMessage(m.error)}</p>}
            <Button disabled={!valid || m.isPending} className="bg-warning text-black hover:bg-warning/85">
              {m.isPending ? <Spinner /> : <Fingerprint />} Reveal author
            </Button>
          </form>

          {m.data && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl border border-warning/40 bg-warning/5 p-5">
              <div className="mb-3 flex items-center gap-2 text-sm text-anon"><ShieldCheck className="size-4" /> Integrity verified (HMAC) · lookup logged</div>
              {m.data.user ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-xl font-bold">{m.data.user.displayName}</span>
                    <RolePill role={m.data.user.role} />
                    {m.data.user.isBanned && <StatusPill status="banned" />}
                  </div>
                  <div className="grid gap-1 text-sm">
                    <p><span className="text-muted-foreground">Username:</span> @{m.data.user.username}</p>
                    <p><span className="text-muted-foreground">Email:</span> {m.data.user.email}</p>
                    <p><span className="text-muted-foreground">User ID:</span> <code className="font-mono text-xs">{m.data.user.id}</code></p>
                    <p><span className="text-muted-foreground">Abuse score:</span> {m.data.user.abuseScore}</p>
                    <p><span className="text-muted-foreground">Joined:</span> <Ago date={m.data.user.createdAt} /></p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-2"><Link href={`/users?focus=${m.data.user.id}`}>Manage in Users</Link></Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">The author&apos;s account has since been deleted.</p>
              )}
            </motion.div>
          )}
        </div>

        <aside className="space-y-3 text-sm">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 flex items-center gap-2 font-semibold"><Lock className="size-4 text-anon" /> How this works</h3>
            <ol className="list-decimal space-y-1.5 pl-4 text-muted-foreground">
              <li>Your request is written to the audit log <b>before</b> any decryption happens.</li>
              <li>The encrypted link (AES-256-GCM) is decrypted with the server-held key.</li>
              <li>An HMAC check proves the link wasn&apos;t tampered with.</li>
              <li>No other surface (feeds, lists, exports) can ever reveal an anonymous author.</li>
            </ol>
          </div>
          <div className="rounded-xl border bg-card p-4 text-muted-foreground">
            Use only for legal obligations or severe abuse (threats, CSAM, coordinated harassment). Review past lookups in the{" "}
            <Link href="/audit-logs?action=IDENTITY_LOOKUP" className="text-primary hover:underline">audit log</Link>.
          </div>
        </aside>
      </div>
    </>
  );
}

export default function IdentityPage() {
  return <Suspense><IdentityInner /></Suspense>;
}
