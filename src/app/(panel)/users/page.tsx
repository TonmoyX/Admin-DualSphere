"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Ban, KeyRound, LogOut, RotateCcw, Search, ShieldCheck, ShieldOff, Trash2, UserCheck } from "lucide-react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Ago, FilterChips, MiniAvatar, PageHeader, Pagination, ReasonDialog, RolePill, Spinner, StatusPill } from "@/components/admin/common";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { del, errorMessage, get, patch, post } from "@/lib/api";
import type { AdminUser, AdminUserDetail, Paged, Role } from "@/lib/types";
import { PermissionsEditor } from "@/components/admin/permissions-editor";
import { useAdminAuth } from "@/providers/providers";

const FRONTEND = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";
type Status = "all" | "active" | "banned" | "unverified" | "flagged";

function UserSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { isAdmin, can, me } = useAdminAuth();
  const qc = useQueryClient();
  const [banOpen, setBanOpen] = useState(false);
  const [banHours, setBanHours] = useState<string>("permanent");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data: u, isLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: async () => (await get<{ user: AdminUserDetail }>(`/admin/users/${id}`)).user,
    enabled: !!id,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["user", id] });
    qc.invalidateQueries({ queryKey: ["users"] });
  };
  const act = (fn: () => Promise<unknown>, msg: string) => fn().then(() => { toast.success(msg); refresh(); }).catch((e) => toast.error(errorMessage(e)));
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => patch(`/admin/users/${id}`, body),
    onSuccess: () => { toast.success("User updated"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const isSelf = u?.id === me?.id;

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {isLoading || !u ? (
          <Spinner className="m-auto mt-20 size-6" />
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <MiniAvatar src={u.avatarUrl} name={u.displayName} className="size-14" />
                <div>
                  <SheetTitle className="flex items-center gap-2">{u.displayName} {u.isVerified && <BadgeCheck className="size-4 text-identity" />}</SheetTitle>
                  <SheetDescription>@{u.username} · {u.email}</SheetDescription>
                  <div className="mt-1 flex gap-1.5"><RolePill role={u.role} /> <StatusPill status={u.isBanned ? "banned" : "active"} /></div>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              {u.isBanned && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <b>Banned:</b> {u.banReason} {u.bannedUntil ? <>· until {new Date(u.bannedUntil).toLocaleString()}</> : "· permanent"}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                {[
                  ["Posts", u.postCount], ["Comments", u.stats.comments], ["Abuse score", u.abuseScore],
                  ["Sessions", u.stats.sessions], ["Devices", u.stats.devices], ["Reports filed", u.stats.reports_filed],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg border p-2">
                    <div className={`font-heading text-xl font-bold ${k === "Abuse score" && Number(v) > 0 ? "text-destructive" : ""}`}>{v}</div>
                    <div className="text-[11px] text-muted-foreground">{k}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Joined <Ago date={u.createdAt} /> · Last login <Ago date={u.lastLoginAt} /></p>
                <p>2FA: {u.mfaEnabled ? <span className="text-anon">enabled</span> : "off"}</p>
                {u.bio && <p className="text-foreground">{u.bio}</p>}
                <a href={`${FRONTEND}/profile/${u.username}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">View public profile ↗</a>
              </div>

              {isAdmin && !isSelf && (
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={u.role} onValueChange={(v) => update.mutate({ role: v as Role })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Changing a role signs the user out everywhere.</p>
                </div>
              )}

              {/* Admins choose exactly what each moderator can do */}
              {isAdmin && u.role === "moderator" && <PermissionsEditor key={u.id + String(u.customPermissions) + (u.permissions ?? []).join()} user={u} />}

              <div className="grid grid-cols-2 gap-2">
                {can("users.manage") && (
                  <Button variant="outline" size="sm" onClick={() => update.mutate({ isVerified: !u.isVerified })}>
                    <UserCheck /> {u.isVerified ? "Unverify" : "Mark verified"}
                  </Button>
                )}
                {can("users.manage") && u.abuseScore > 0 && (
                  <Button variant="outline" size="sm" onClick={() => update.mutate({ resetAbuseScore: true })}><RotateCcw /> Reset abuse score</Button>
                )}
                {can("users.manage") && u.avatarUrl && (
                  <Button variant="outline" size="sm" onClick={() => update.mutate({ removeAvatar: true })}>Remove avatar</Button>
                )}
                {can("users.manage") && !isSelf && (
                  <Button variant="outline" size="sm" onClick={() => act(() => post(`/admin/users/${u.id}/revoke-sessions`), "Sessions revoked")}><LogOut /> Revoke sessions</Button>
                )}
                {can("users.manage") && !isSelf && u.mfaEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Turn off 2FA for @${u.username}? Use this only if they lost access to their authenticator. They'll be signed out everywhere.`)) {
                        act(() => post(`/admin/users/${u.id}/reset-mfa`), "2FA turned off for this user");
                      }
                    }}
                  >
                    <ShieldOff /> Reset 2FA
                  </Button>
                )}
                {!isSelf && can("users.ban") && (u.isBanned ? (
                  <Button variant="outline" size="sm" onClick={() => act(() => post(`/moderation/users/${u.id}/unban`), "User unbanned")}><ShieldCheck /> Unban</Button>
                ) : (
                  <Button variant="destructive" size="sm" onClick={() => setBanOpen(true)}><Ban /> Ban user</Button>
                ))}
                {isAdmin && !isSelf && u.role !== "admin" && (
                  <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 /> Delete account</Button>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Recent identity posts</h3>
                <p className="mb-2 text-xs text-muted-foreground"><KeyRound className="mr-1 inline size-3" />Anonymous posts are never listed here. Unmasking requires an audited identity lookup per post.</p>
                <div className="space-y-2">
                  {u.recentPosts.length === 0 && <p className="text-sm text-muted-foreground">No posts.</p>}
                  {u.recentPosts.map((p) => (
                    <div key={p.id} className="rounded-lg border p-2.5 text-sm">
                      <p className="line-clamp-2">{p.content || <i className="text-muted-foreground">(media only)</i>}</p>
                      <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                        <span>♥ {p.likes_count}</span><span>💬 {p.comments_count}</span>{p.is_removed && <span className="text-destructive">removed</span>}
                        <span className="ml-auto"><Ago date={p.created_at} /></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <ReasonDialog
              open={banOpen}
              onOpenChange={setBanOpen}
              title={`Ban @${u.username}?`}
              description="They'll be signed out everywhere immediately."
              confirmLabel="Ban user"
              extra={
                <div className="space-y-1.5">
                  <Label>Duration</Label>
                  <Select value={banHours} onValueChange={setBanHours}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="168">7 days</SelectItem>
                      <SelectItem value="720">30 days</SelectItem>
                      <SelectItem value="permanent">Permanent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
              onConfirm={(reason) =>
                post(`/moderation/users/${u.id}/ban`, { reason, durationHours: banHours === "permanent" ? null : Number(banHours) })
                  .then(() => { toast.success("User banned"); refresh(); })
                  .catch((e) => toast.error(errorMessage(e)))
              }
            />
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete @{u.username} permanently?</AlertDialogTitle>
                  <AlertDialogDescription>Their profile, identity posts, comments and likes are deleted. This cannot be undone. The action is audit-logged.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => act(() => del(`/admin/users/${u.id}`), "Account deleted").then(onClose)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function UsersInner() {
  const focus = useSearchParams().get("focus");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [role, setRole] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(focus);

  const params = new URLSearchParams({ page: String(page), limit: "25" });
  if (search) params.set("q", search);
  if (status !== "all") params.set("status", status);
  if (role !== "all") params.set("role", role);
  const { data, isLoading } = useQuery({ queryKey: ["users", params.toString()], queryFn: () => get<Paged<AdminUser>>(`/admin/users?${params}`), placeholderData: keepPreviousData });

  return (
    <>
      <PageHeader title="Users" desc="Manage accounts, roles and bans." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(q); setPage(1); }} className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Username, email or name" className="pl-8" />
        </form>
        <FilterChips value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[
          { v: "all", label: "All" }, { v: "active", label: "Active" }, { v: "banned", label: "Banned" }, { v: "unverified", label: "Unverified" }, { v: "flagged", label: "Flagged" },
        ]} />
        <Select value={role} onValueChange={(v) => { setRole(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="moderator">Moderators</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="hidden sm:table-cell">Role</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Posts</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Abuse</TableHead>
              <TableHead className="hidden md:table-cell">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6}><Spinner className="mx-auto" /></TableCell></TableRow>}
            {data?.items.map((u) => (
              <TableRow key={u.id} onClick={() => setSelected(u.id)} className="cursor-pointer">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <MiniAvatar src={u.avatarUrl} name={u.displayName} />
                    <div>
                      <div className="flex items-center gap-1 font-medium">{u.displayName} {u.isVerified && <BadgeCheck className="size-3.5 text-identity" />}</div>
                      <div className="max-w-[60vw] truncate text-xs text-muted-foreground sm:max-w-none">@{u.username} · {u.email}</div>
                      <div className="mt-1 flex gap-1 sm:hidden"><RolePill role={u.role} /> <StatusPill status={u.isBanned ? "banned" : "active"} /></div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell"><RolePill role={u.role} /></TableCell>
                <TableCell className="hidden sm:table-cell"><StatusPill status={u.isBanned ? "banned" : "active"} /></TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">{u.postCount}</TableCell>
                <TableCell className={`hidden text-right tabular-nums lg:table-cell ${u.abuseScore > 0 ? "text-destructive" : "text-muted-foreground"}`}>{u.abuseScore}</TableCell>
                <TableCell className="hidden md:table-cell"><Ago date={u.createdAt} /></TableCell>
              </TableRow>
            ))}
            {data && data.items.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No users match.</TableCell></TableRow>}
          </TableBody>
        </Table>
        {data && <Pagination page={page} total={data.total} limit={25} onPage={setPage} />}
      </div>
      <UserSheet id={selected} onClose={() => setSelected(null)} />
    </>
  );
}

export default function UsersPage() {
  return <Suspense><UsersInner /></Suspense>;
}
