"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} />;
}

export function Ago({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  return (
    <time title={new Date(date).toLocaleString()} className="text-xs whitespace-nowrap text-muted-foreground">
      {formatDistanceToNowStrict(new Date(date), { addSuffix: true })}
    </time>
  );
}

export function MiniAvatar({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  return (
    <Avatar className={cn("size-8", className)}>
      {src && <AvatarImage src={src} className="object-cover" />}
      <AvatarFallback className="bg-identity/15 text-xs text-identity">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

const ACRONYMS = new Set(["mfa", "2fa", "ip", "id", "url", "api", "dm"]);
/** "IDENTITY_LOOKUP" / "spam:keyword" → "Identity lookup" / "Spam: keyword" — readable labels instead of raw codes. */
export function humanize(code: string | null | undefined): string {
  if (!code) return "";
  const words = code.replace(/[_-]+/g, " ").replace(/:/g, ": ").trim().toLowerCase().split(/\s+/);
  return words.map((w, i) => (ACRONYMS.has(w) ? w.toUpperCase() : i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

export function RolePill({ role }: { role: string }) {
  const cls = role === "admin" ? "bg-warning/15 text-warning" : role === "moderator" ? "bg-cyan-400/15 text-cyan-300" : "bg-muted text-muted-foreground";
  return <Badge className={cn("border-0 text-[11px] font-semibold", cls)}>{humanize(role)}</Badge>;
}

export function VisibilityPill({ v }: { v: "identity" | "anonymous" }) {
  return (
    <Badge className={cn("border-0 text-[11px] font-semibold", v === "anonymous" ? "bg-anon/15 text-anon" : "bg-identity/15 text-identity")}>
      {v === "anonymous" ? "Anonymous" : "Identity"}
    </Badge>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning",
    actioned: "bg-destructive/15 text-destructive",
    dismissed: "bg-muted text-muted-foreground",
    reviewed: "bg-cyan-400/15 text-cyan-300",
    banned: "bg-destructive/15 text-destructive",
    removed: "bg-destructive/15 text-destructive",
    live: "bg-anon/15 text-anon",
    active: "bg-anon/15 text-anon",
    approved: "bg-emerald-500/15 text-emerald-500",
    rejected: "bg-destructive/15 text-destructive",
  };
  return <Badge className={cn("border-0 text-[11px] font-semibold", map[status] ?? "bg-muted")}>{humanize(status)}</Badge>;
}

export function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
      <span>{total.toLocaleString()} total</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft /></Button>
        <span className="tabular-nums">{page} / {pages}</span>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight /></Button>
      </div>
    </div>
  );
}

/** Confirm dialog that requires a written reason (saved to the audit log). */
export function ReasonDialog({
  open, onOpenChange, title, description, confirmLabel = "Confirm", destructive = true, onConfirm, extra, minLength = 3,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: (reason: string) => Promise<unknown> | void;
  extra?: ReactNode;
  minLength?: number;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setReason(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {extra}
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason (recorded in the audit log)</Label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Explain why…" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={reason.trim().length < minLength || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
                onOpenChange(false);
                setReason("");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`;
}

export function FilterChips<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", value === o.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
