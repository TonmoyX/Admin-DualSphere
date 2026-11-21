"use client";

import { motion } from "framer-motion";
import { Shield, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { errorMessage, post } from "@/lib/api";
import type { Me } from "@/lib/types";
import { useAdminAuth } from "@/providers/providers";

type LoginRes = { mfaRequired: true; challenge: string } | { mfaRequired: false; user: Me };

export default function AdminLogin() {
  const { me, setMe, logout } = useAdminAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me && me.role !== "user") router.replace("/");
  }, [me, router]);

  const finish = async (u: Me) => {
    if (u.role === "user") {
      await logout();
      setError("This account doesn't have staff access.");
      setChallenge(null);
      return;
    }
    setMe(u);
    router.replace("/");
  };

  return (
    <div className="relative grid overflow-hidden min-h-dvh place-items-center bg-grid px-4">
      <div className="pointer-events-none absolute top-0 left-1/2 h-80 w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(251,191,36,0.10),transparent_65%)]" />
      <motion.form
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          try {
            if (challenge) {
              const r = await post<{ user: Me }>("/auth/login/mfa", { challenge, code });
              await finish(r.user);
            } else {
              const r = await post<LoginRes>("/auth/login", { identifier, password });
              if (r.mfaRequired) setChallenge(r.challenge);
              else await finish(r.user);
            }
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
        className="relative w-full max-w-sm space-y-4 rounded-2xl border bg-card p-7 shadow-2xl"
      >
        <div className="mb-2 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-warning/15 text-warning">{challenge ? <ShieldCheck /> : <Shield />}</div>
          <div>
            <h1 className="text-xl font-bold">DualSphere Admin</h1>
            <p className="text-xs text-muted-foreground">Staff only · all actions are audited</p>
          </div>
        </div>
        {challenge ? (
          <div className="space-y-1.5">
            <Label>Authenticator code</Label>
            <Input autoFocus inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="h-12 text-center font-mono text-2xl tracking-[0.5em]" placeholder="000000" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="id">Email or username</Label>
              <Input id="id" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Password</Label>
              <PasswordInput id="pw" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button className="h-10 w-full" disabled={busy || (!!challenge && code.length !== 6)}>{busy && <Spinner />} {challenge ? "Verify" : "Sign in"}</Button>
      </motion.form>
    </div>
  );
}
