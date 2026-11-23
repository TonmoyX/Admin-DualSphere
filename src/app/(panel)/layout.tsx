"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppSidebar } from "@/components/admin/app-sidebar";
import { Spinner } from "@/components/admin/common";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getSocket } from "@/lib/socket";
import { useAdminAuth } from "@/providers/providers";

import type { Permission } from "@/lib/types";

/** Which permission each section needs (admins pass everything). Identity lookup is admin-only. */
const SECTION: { path: string; perm?: Permission; admin?: true }[] = [
  { path: "/identity", admin: true },
  { path: "/audit-logs", perm: "audit.view" },
  { path: "/settings", perm: "settings.manage" },
  { path: "/abuse", perm: "abuse.view" },
  { path: "/reports", perm: "reports.view" },
  { path: "/posts", perm: "posts.view" },
  { path: "/comments", perm: "comments.view" },
  { path: "/feedback", perm: "feedback.view" },
  { path: "/users", perm: "users.view" },
  { path: "/communities", perm: "communities.view" },
  { path: "/ad-review", perm: "ads.review" },
  { path: "/advertisers", perm: "ads.manage" },
  { path: "/payouts", perm: "payouts.view" },
  { path: "/payments", perm: "finance.view" },
  { path: "/revenue", perm: "finance.view" },
  { path: "/media", perm: "media.view" },
];

export default function PanelLayout({ children }: { children: ReactNode }) {
  const { me, loading, isAdmin, can, setMe, refetch } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!me || me.role === "user") router.replace("/login");
    else {
      const sec = SECTION.find((x) => pathname.startsWith(x.path));
      if (sec && ((sec.admin && !isAdmin) || (sec.perm && !can(sec.perm)))) router.replace("/account");
      else if (pathname === "/" && !can("dashboard.view")) router.replace("/account");
    }
  }, [me, loading, isAdmin, can, pathname, router]);

  // Live staff events
  useEffect(() => {
    if (!me) return;
    const s = getSocket();
    const onReport = (r: { reason: string; targetType: string }) => {
      toast.warning(`New report: ${r.reason}`, { description: `A ${r.targetType} was reported`, action: { label: "Review", onClick: () => router.push("/reports") } });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    };
    const onFlag = () => qc.invalidateQueries({ queryKey: ["stats"] });
    const onSignup = (p: { username: string }) => { toast.info(`New member: @${p.username}`); qc.invalidateQueries({ queryKey: ["stats"] }); };
    const onPresence = (p: { online: number }) => setOnline(p.online);
    const onFeedback = () => {
      toast.info("New problem report", { action: { label: "View", onClick: () => router.push("/feedback") } });
      qc.invalidateQueries({ queryKey: ["feedback"] });
    };
    const onRevoked = () => { setMe(null); router.replace("/login"); };
    const onPerms = () => { void refetch(); toast.info("Your permissions were updated by an admin"); };
    s.on("admin:report", onReport);
    s.on("admin:flagged", onFlag);
    s.on("admin:signup", onSignup);
    s.on("presence", onPresence);
    s.on("admin:feedback", onFeedback);
    s.on("session:revoked", onRevoked);
    s.on("permissions:update", onPerms);
    return () => {
      s.off("permissions:update", onPerms);
      s.off("admin:report", onReport);
      s.off("admin:flagged", onFlag);
      s.off("admin:signup", onSignup);
      s.off("presence", onPresence);
      s.off("admin:feedback", onFeedback);
      s.off("session:revoked", onRevoked);
    };
  }, [me, qc, router, setMe, refetch]);

  if (loading || !me || me.role === "user") {
    return <div className="grid min-h-dvh place-items-center"><Spinner className="size-6" /></div>;
  }

  return (
    <SidebarProvider>
      <AppSidebar online={online} />
      <SidebarInset className="min-w-0">
        <header className="glass sticky top-0 z-30 flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-muted-foreground capitalize">{pathname === "/" ? "Dashboard" : pathname.split("/")[1]?.replace("-", " ")}</span>
          {!me.mfaEnabled && (
            <button onClick={() => router.push("/account")} className="ml-auto rounded-md bg-warning/15 px-2 py-1 text-xs text-warning hover:bg-warning/25">
              ⚠ Enable 2FA on your account
            </button>
          )}
        </header>
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
