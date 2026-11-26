"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Clock, Eye, FileSearch, History, MessagesSquare, Search, ShieldAlert, Trash2, Users, VenetianMask, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Ago, MiniAvatar, PageHeader, Pagination, Spinner } from "@/components/admin/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage, get, post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAdminAuth } from "@/providers/providers";

const FRONTEND = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";

type Person = { id: string; username: string; displayName: string; avatarUrl: string | null };
interface Case {
  id: string;
  reason: string;
  openedAt: string;
  expiresAt: string;
  closedAt: string | null;
  active: boolean;
  admin: { username: string } | null;
  target: { id: string | null; username: string; displayName: string | null };
}
interface Conversation {
  id: string;
  deleted: boolean;
  isGroup: boolean;
  title: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  deletedCount: number;
  participants: Person[];
}
interface Message {
  id: string;
  kind: string;
  content: string;
  media: { url: string; type: string }[];
  sentAt: string;
  editedAt: string | null;
  editHistory: { content: string; editedAt: string }[];
  deleted: { reason: string; at: string } | null;
  removedByModerator: boolean;
  anonymous?: boolean;
  sender: Person | null;
}
interface AnonPost {
  id: string;
  content: string;
  media: { url: string; type: string }[];
  isShare: boolean;
  inCommunity: boolean;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  removed: boolean;
  removedReason: string | null;
  createdAt: string;
  editedAt: string | null;
}

function InvestigationsInner() {
  const caseId = useSearchParams().get("case");
  return caseId ? <CaseView id={caseId} /> : <Home />;
}

export default function InvestigationsPage() {
  return (
    <Suspense>
      <InvestigationsInner />
    </Suspense>
  );
}

/* ─────────────── Open a case + case history ─────────────── */

function Home() {
  const { me } = useAdminAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  const [target, setTarget] = useState<Person | null>(null);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [ack, setAck] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const users = useQuery({
    queryKey: ["inv-user-search", debounced],
    queryFn: () => get<{ items: Person[] }>(`/admin/users?q=${encodeURIComponent(debounced)}&limit=8`),
    enabled: debounced.length >= 2 && !target,
  });
  const cases = useQuery({
    queryKey: ["investigations", page],
    queryFn: () => get<{ items: Case[]; total: number }>(`/admin/investigations?page=${page}&limit=15`),
    placeholderData: keepPreviousData,
  });

  const open = useMutation({
    mutationFn: () => post<{ case: Case }>("/admin/investigations", { targetUserId: target!.id, reason: reason.trim(), mfaCode: code || undefined }),
    onSuccess: (r) => router.push(`/investigations?case=${r.case.id}`),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const valid = !!target && reason.trim().length >= 10 && ack && (!me?.mfaEnabled || code.length === 6);

  return (
    <>
      <PageHeader
        title="Investigations"
        desc="Open a case on one account to read its conversations (incl. messages deleted or edited in the last 90 days) and see every anonymous post it wrote. Disclosed to users in the Privacy Policy."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {!me?.mfaEnabled && (
            <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <b className="text-warning">Two-factor authentication required.</b>{" "}
                <span className="text-muted-foreground">Investigations require 2FA on your account.</span>{" "}
                <Link href="/account" className="text-primary hover:underline">Enable 2FA →</Link>
              </div>
            </div>
          )}

          <form className="space-y-4 rounded-xl border bg-card p-5" onSubmit={(e) => { e.preventDefault(); if (valid) open.mutate(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="inv-user">Account to investigate</Label>
              {target ? (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
                  <MiniAvatar src={target.avatarUrl} name={target.displayName} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{target.displayName}</div>
                    <div className="truncate text-xs text-muted-foreground">@{target.username}</div>
                  </div>
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => setTarget(null)} aria-label="Change"><X /></Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="inv-user" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username, name or email" className="pl-9" autoComplete="off" />
                  {debounced.length >= 2 && (
                    <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                      {users.isLoading ? (
                        <div className="grid place-items-center py-4"><Spinner /></div>
                      ) : !users.data?.items.length ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">No accounts found</p>
                      ) : (
                        users.data.items.map((u) => (
                          <button key={u.id} type="button" onClick={() => setTarget(u)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent">
                            <MiniAvatar src={u.avatarUrl} name={u.displayName} className="size-7" />
                            <span className="min-w-0 flex-1 truncate text-sm"><b className="font-medium">{u.displayName}</b> <span className="text-muted-foreground">@{u.username}</span></span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-reason">Reason (permanently recorded)</Label>
              <Textarea id="inv-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. Report #1234 — credible threat sent by DM; police request ref. ABC-123" />
              <p className="text-xs text-muted-foreground">{reason.trim().length}/10 minimum</p>
            </div>
            {me?.mfaEnabled && (
              <div className="space-y-1.5">
                <Label htmlFor="inv-code">Authenticator code</Label>
                <Input id="inv-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-40 text-center font-mono tracking-widest" placeholder="000000" />
              </div>
            )}
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
              <span className="text-muted-foreground">I have a legitimate safety or legal reason. I understand this case and everything I open in it is logged and visible to other admins.</span>
            </label>
            <Button type="submit" variant="destructive" disabled={!valid || open.isPending}>
              {open.isPending ? <Spinner /> : <FileSearch />} Open 30-minute case
            </Button>
          </form>
        </div>

        <aside className="space-y-3 rounded-xl border bg-card p-5 text-sm">
          <h3 className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4 text-warning" /> How cases work</h3>
          <ul className="list-disc space-y-1.5 pl-4 text-muted-foreground">
            <li>One case covers one account and ends after 30 minutes (or when you close it).</li>
            <li>You can read every chat the account is or was in — both sides — including deleted messages and earlier versions of edited ones (kept 90 days).</li>
            <li>You can see every anonymous post the account wrote.</li>
            <li>Opening the case and each conversation or list you view is written to the audit log with your reason.</li>
          </ul>
        </aside>
      </div>

      <h2 className="mt-8 mb-3 font-heading text-lg font-semibold">Case history (all admins)</h2>
      <div className="overflow-hidden rounded-xl border bg-card">
        {cases.isLoading && <div className="grid place-items-center py-8"><Spinner /></div>}
        {cases.data?.items.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No investigations yet.</p>}
        {cases.data?.items.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3 text-sm last:border-0">
            <span className="font-medium">@{c.target.username}</span>
            <span className="text-muted-foreground">by @{c.admin?.username ?? "deleted"}</span>
            {c.active ? <Badge className="border-0 bg-warning/15 text-warning">Active</Badge> : <Badge variant="outline">Ended</Badge>}
            <span className="min-w-0 flex-1 truncate text-muted-foreground" title={c.reason}>{c.reason}</span>
            <span className="text-xs text-muted-foreground"><Ago date={c.openedAt} /></span>
            {c.active && c.admin?.username === me?.username && (
              <Button size="xs" variant="outline" asChild><Link href={`/investigations?case=${c.id}`}>Resume</Link></Button>
            )}
          </div>
        ))}
        {cases.data && cases.data.total > 15 && <Pagination page={page} total={cases.data.total} limit={15} onPage={setPage} />}
      </div>
    </>
  );
}

/* ─────────────── Inside a case ─────────────── */

function useCountdown(to: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!to) return null;
  const left = Math.max(0, new Date(to).getTime() - now);
  return { left, label: `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}` };
}

function CaseView({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const c = useQuery({ queryKey: ["investigation", id], queryFn: async () => (await get<{ case: Case }>(`/admin/investigations/${id}`)).case });
  const cd = useCountdown(c.data?.expiresAt);
  const active = !!c.data?.active && (cd?.left ?? 1) > 0;

  const close = async () => {
    await post(`/admin/investigations/${id}/close`).catch(() => {});
    qc.invalidateQueries({ queryKey: ["investigations"] });
    toast.success("Case closed");
    router.push("/investigations");
  };

  if (c.isLoading) return <div className="grid place-items-center py-20"><Spinner className="size-6" /></div>;
  if (!c.data) return <p className="py-20 text-center text-muted-foreground">{errorMessage(c.error)}</p>;
  const t = c.data.target;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" asChild><Link href="/investigations"><ArrowLeft /> Cases</Link></Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-bold">
            Investigating {t.displayName ?? t.username} <span className="font-normal text-muted-foreground">@{t.username}</span>
          </h1>
          <p className="truncate text-sm text-muted-foreground" title={c.data.reason}>Reason: {c.data.reason}</p>
        </div>
        {active ? (
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-sm", (cd?.left ?? 0) < 5 * 60_000 ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")}>
            <Clock className="size-4" /> {cd?.label}
          </span>
        ) : (
          <Badge variant="outline">Ended</Badge>
        )}
        {t.id && <Button size="sm" variant="outline" asChild><a href={`${FRONTEND}/profile/${t.username}`} target="_blank" rel="noreferrer">Profile</a></Button>}
        {active && <Button size="sm" variant="destructive" onClick={close}>Close case</Button>}
      </div>

      {!active ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Clock className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="font-medium">This case has ended</p>
          <p className="mb-4 text-sm text-muted-foreground">Open a new case (with a reason) to keep investigating.</p>
          <Button asChild><Link href={`/investigations?q=${encodeURIComponent(t.username)}`}>Open a new case</Link></Button>
        </div>
      ) : (
        <Tabs defaultValue="chats">
          <TabsList>
            <TabsTrigger value="chats"><MessagesSquare /> Conversations</TabsTrigger>
            <TabsTrigger value="anon"><VenetianMask /> Anonymous posts</TabsTrigger>
          </TabsList>
          <TabsContent value="chats" className="mt-3"><Chats caseId={id} targetId={t.id} /></TabsContent>
          <TabsContent value="anon" className="mt-3"><AnonPosts caseId={id} /></TabsContent>
        </Tabs>
      )}
    </>
  );
}

const caseError = (e: unknown) => (e instanceof ApiError && e.code === "CASE_EXPIRED" ? "This case has ended — open a new one." : errorMessage(e));

function convName(c: Conversation, targetId: string | null) {
  if (c.title) return c.title;
  const others = c.participants.filter((p) => p.id !== targetId);
  return others.length ? others.map((p) => p.displayName).join(", ") : c.isGroup ? "Group" : "Conversation";
}

function Chats({ caseId, targetId }: { caseId: string; targetId: string | null }) {
  const [sel, setSel] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["inv-convs", caseId],
    queryFn: async () => (await get<{ conversations: Conversation[] }>(`/admin/investigations/${caseId}/conversations`)).conversations,
    retry: false,
  });
  const selected = list.data?.find((c) => c.id === sel) ?? null;

  if (list.isLoading) return <div className="grid place-items-center py-12"><Spinner /></div>;
  if (list.error) return <p className="py-12 text-center text-sm text-destructive">{caseError(list.error)}</p>;
  if (!list.data?.length) return <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">This account has no conversations.</p>;

  return (
    <div className="grid min-h-[60vh] overflow-hidden rounded-xl border bg-card md:grid-cols-[300px_1fr]">
      <div className="max-h-[70vh] overflow-y-auto border-b md:border-r md:border-b-0">
        {list.data.map((c) => (
          <button key={c.id} type="button" onClick={() => setSel(c.id)} className={cn("flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left hover:bg-accent", sel === c.id && "bg-accent")}>
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted">{c.isGroup ? <Users className="size-4" /> : <MessagesSquare className="size-4" />}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{convName(c, targetId)}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {c.messageCount} msgs
                {c.deletedCount > 0 && <span className="text-destructive">· {c.deletedCount} deleted</span>}
                {c.deleted && <Badge variant="outline" className="h-4 px-1 text-[10px]">chat deleted</Badge>}
              </span>
            </span>
            {c.lastMessageAt && <span className="text-[11px] text-muted-foreground"><Ago date={c.lastMessageAt} /></span>}
          </button>
        ))}
      </div>
      <div className="min-w-0">
        {selected ? <Thread caseId={caseId} conv={selected} targetId={targetId} /> : (
          <div className="grid h-full place-items-center p-10 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Eye className="size-4" /> Pick a conversation — opening it is logged.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Thread({ caseId, conv, targetId }: { caseId: string; conv: Conversation; targetId: string | null }) {
  const q = useQuery({
    queryKey: ["inv-msgs", caseId, conv.id],
    queryFn: () => get<{ messages: Message[] }>(`/admin/investigations/${caseId}/conversations/${conv.id}`),
    retry: false,
  });
  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="border-b px-4 py-2.5">
        <div className="font-medium">{convName(conv, targetId)}</div>
        <div className="truncate text-xs text-muted-foreground">{conv.participants.map((p) => `@${p.username}`).join(", ")}</div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {q.isLoading && <div className="grid place-items-center py-10"><Spinner /></div>}
        {q.error && <p className="py-10 text-center text-sm text-destructive">{caseError(q.error)}</p>}
        {q.data?.messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages.</p>}
        {q.data?.messages.map((m) => <Bubble key={m.id} m={m} mine={!!targetId && m.sender?.id === targetId} />)}
      </div>
    </div>
  );
}

function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  const [showHistory, setShowHistory] = useState(false);
  if (m.kind === "system") return <p className="text-center text-xs text-muted-foreground">{m.content} · <Ago date={m.sentAt} /></p>;
  return (
    <div className={cn("flex gap-2", mine && "flex-row-reverse")}>
      <MiniAvatar src={m.sender?.avatarUrl ?? null} name={m.sender?.displayName ?? "?"} className="mt-1 size-7 shrink-0" />
      <div className={cn("max-w-[75%] rounded-xl border px-3 py-2 text-sm", mine ? "bg-primary/10" : "bg-muted/50", m.deleted && "border-destructive/40 border-dashed bg-destructive/5")}>
        <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <b className="font-semibold text-foreground">{m.sender ? `@${m.sender.username}` : "deleted account"}</b>
          <span title={new Date(m.sentAt).toLocaleString()}>{new Date(m.sentAt).toLocaleString()}</span>
          {m.deleted && (
            <Badge className="h-4 border-0 bg-destructive/15 px-1 text-[10px] text-destructive">
              <Trash2 className="size-2.5" /> {m.deleted.reason === "unsent" ? "unsent" : "chat deleted"} {new Date(m.deleted.at).toLocaleDateString()}
            </Badge>
          )}
          {m.removedByModerator && <Badge variant="outline" className="h-4 px-1 text-[10px]">removed by mod</Badge>}
          {m.anonymous && <Badge className="h-4 border-0 bg-anon/15 px-1 text-[10px] text-anon" title="Other members saw this as Anonymous"><VenetianMask className="size-2.5" /> sent anonymously</Badge>}
          {m.editHistory.length > 0 && (
            <button type="button" onClick={() => setShowHistory((s) => !s)} className="inline-flex items-center gap-0.5 text-primary hover:underline">
              <History className="size-3" /> edited ×{m.editHistory.length}
            </button>
          )}
        </div>
        {m.kind === "heart" ? <span className="text-lg">❤️</span> : m.content && <p className="break-words whitespace-pre-wrap">{m.content}</p>}
        {m.media.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {m.media.map((x, i) =>
              x.type === "image" ? (
                <a key={i} href={x.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.url} alt="" className="size-24 rounded-md object-cover" />
                </a>
              ) : (
                <a key={i} href={x.url} target="_blank" rel="noreferrer" className="rounded-md border px-2 py-1 text-xs text-primary hover:underline">{x.type} file</a>
              ),
            )}
          </div>
        )}
        {showHistory && (
          <div className="mt-2 space-y-1 border-t pt-2 text-xs">
            {m.editHistory.map((h, i) => (
              <p key={i} className="text-muted-foreground"><span className="font-mono">{new Date(h.editedAt).toLocaleString()}</span> — before: “{h.content}”</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AnonPosts({ caseId }: { caseId: string }) {
  const q = useQuery({
    queryKey: ["inv-anon", caseId],
    queryFn: async () => (await get<{ posts: AnonPost[] }>(`/admin/investigations/${caseId}/anonymous-posts`)).posts,
    retry: false,
  });
  if (q.isLoading) return <div className="grid place-items-center py-12"><Spinner /> <span className="mt-2 text-xs text-muted-foreground">Checking every anonymous post…</span></div>;
  if (q.error) return <p className="py-12 text-center text-sm text-destructive">{caseError(q.error)}</p>;
  if (!q.data?.length) return <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">This account hasn&apos;t written any anonymous posts.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{q.data.length} anonymous post{q.data.length > 1 ? "s" : ""} written by this account (integrity verified by HMAC).</p>
      {q.data.map((p) => (
        <div key={p.id} className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge className="border-0 bg-anon/15 text-anon"><VenetianMask className="size-3" /> Anonymous</Badge>
            {p.isShare && <Badge variant="outline">share</Badge>}
            {p.inCommunity && <Badge variant="outline">community</Badge>}
            {p.removed && <Badge className="border-0 bg-destructive/15 text-destructive">removed{p.removedReason ? `: ${p.removedReason}` : ""}</Badge>}
            <span>{new Date(p.createdAt).toLocaleString()}</span>
            {p.editedAt && <span>· edited</span>}
            <span className="ml-auto">❤ {p.likes} · 💬 {p.comments} · ↻ {p.shares} · 👁 {p.views}</span>
          </div>
          {p.content && <p className="text-sm break-words whitespace-pre-wrap">{p.content}</p>}
          {p.media.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.media.map((x, i) => x.type === "image" ? (
                <a key={i} href={x.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.url} alt="" className="size-24 rounded-md object-cover" />
                </a>
              ) : (
                <a key={i} href={x.url} target="_blank" rel="noreferrer" className="rounded-md border px-2 py-1 text-xs text-primary hover:underline">video</a>
              ))}
            </div>
          )}
          <a href={`${FRONTEND}/post/${p.id}`} target="_blank" rel="noreferrer" className="mt-2 inline-block font-mono text-xs text-primary hover:underline">{p.id}</a>
        </div>
      ))}
    </div>
  );
}
