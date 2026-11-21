"use client";

import { useMutation } from "@tanstack/react-query";
import { KeyRound, Palette, ShieldCheck, ShieldOff } from "lucide-react";
import { ThemePicker } from "@/components/common/theme-picker";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, RolePill, Spinner } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { errorMessage, post } from "@/lib/api";
import { useAdminAuth } from "@/providers/providers";

export default function AccountPage() {
  const { me, refetch } = useAdminAuth();
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [off, setOff] = useState({ open: false, code: "", password: "" });

  const start = useMutation({ mutationFn: () => post<{ qrDataUrl: string; secret: string }>("/auth/mfa/setup"), onSuccess: setSetup, onError: (e) => toast.error(errorMessage(e)) });
  const enable = useMutation({
    mutationFn: () => post("/auth/mfa/enable", { code }),
    onSuccess: () => { toast.success("2FA enabled"); setSetup(null); setCode(""); refetch(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const disable = useMutation({
    mutationFn: () => post("/auth/mfa/disable", { code: off.code, password: off.password }),
    onSuccess: () => { toast.success("2FA turned off"); setOff({ open: false, code: "", password: "" }); refetch(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const change = useMutation({
    mutationFn: () => post("/auth/change-password", pw),
    onSuccess: () => { toast.success("Password updated"); setPw({ currentPassword: "", newPassword: "" }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!me) return null;
  return (
    <>
      <PageHeader title="My account" desc={`Signed in as @${me.username}`}><RolePill role={me.role} /></PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Two-factor authentication</CardTitle>
            <CardDescription>Required for identity lookups. Protects the most sensitive actions on the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            {me.mfaEnabled ? (
              <div className="space-y-3">
                <p className="text-sm text-anon">✓ 2FA is enabled on this account.</p>
                {off.open ? (
                  <form className="space-y-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3" onSubmit={(e) => { e.preventDefault(); disable.mutate(); }}>
                    <p className="text-sm">Confirm with your password and a code from your authenticator app.</p>
                    <PasswordInput placeholder="Password" autoComplete="current-password" value={off.password} onChange={(e) => setOff({ ...off, password: e.target.value })} required />
                    <Input value={off.code} onChange={(e) => setOff({ ...off, code: e.target.value.replace(/\D/g, "") })} maxLength={6} inputMode="numeric" placeholder="000000" className="w-32 text-center font-mono tracking-widest" required />
                    <p className="text-xs text-muted-foreground">Identity lookups need 2FA, so you won&apos;t be able to use them until you turn it back on.</p>
                    <div className="flex gap-2">
                      <Button type="submit" variant="destructive" disabled={off.code.length !== 6 || !off.password || disable.isPending}>{disable.isPending && <Spinner />} Turn off 2FA</Button>
                      <Button type="button" variant="ghost" onClick={() => setOff({ open: false, code: "", password: "" })}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <Button variant="outline" onClick={() => setOff({ ...off, open: true })}><ShieldOff /> Turn off 2FA</Button>
                )}
              </div>
            ) : setup ? (
              <div className="flex flex-col gap-4 sm:flex-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup.qrDataUrl} alt="2FA QR code" className="size-40 rounded-lg bg-white p-2" />
                <div className="flex-1 space-y-3 text-sm">
                  <p>Scan with your authenticator app, then enter the code.</p>
                  <code className="block rounded bg-muted px-2 py-1 font-mono text-xs break-all">{setup.secret}</code>
                  <div className="flex gap-2">
                    <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" placeholder="000000" className="w-28 text-center font-mono tracking-widest" />
                    <Button onClick={() => enable.mutate()} disabled={code.length !== 6 || enable.isPending}>{enable.isPending && <Spinner />} Enable</Button>
                  </div>
                </div>
              </div>
            ) : (
              <Button onClick={() => start.mutate()} disabled={start.isPending}>{start.isPending ? <Spinner /> : <ShieldCheck />} Set up 2FA</Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="size-4" /> Change password</CardTitle>
            <CardDescription>Signs out all your other sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); change.mutate(); }}>
              <PasswordInput placeholder="Current password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
              <PasswordInput placeholder="New password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={8} />
              <Button disabled={change.isPending}>{change.isPending && <Spinner />} Update password</Button>
            </form>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="size-4" /> Appearance</CardTitle>
            <CardDescription>Light or dark theme for the admin panel on this device.</CardDescription>
          </CardHeader>
          <CardContent className="max-w-md"><ThemePicker /></CardContent>
        </Card>
      </div>
    </>
  );
}
