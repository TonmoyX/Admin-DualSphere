"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity, Ban, ExternalLink, FileText, Flag, Fingerprint, Image as ImageIcon, LayoutDashboard, LogOut, MessageSquare,
  MessageSquareWarning, ScrollText, Settings, Shield, UserCog, Users, UsersRound, Megaphone, Store, Banknote, CreditCard, LineChart, BarChart3, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { get } from "@/lib/api";
import type { Permission } from "@/lib/types";
import { useAdminAuth } from "@/providers/providers";
import { MiniAvatar, RolePill } from "./common";

const FRONTEND = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";

type Item = { href: string; label: string; Icon: typeof Users; admin?: boolean; perm?: Permission; badge?: "reports" | "flags" };
const groups: { label: string; items: Item[] }[] = [
  { label: "Overview", items: [{ href: "/", label: "Dashboard", Icon: LayoutDashboard, perm: "dashboard.view" }] },
  {
    label: "Moderation",
    items: [
      { href: "/reports", label: "Reports", Icon: Flag, badge: "reports", perm: "reports.view" },
      { href: "/posts", label: "Posts", Icon: FileText, perm: "posts.view" },
      { href: "/comments", label: "Comments", Icon: MessageSquare, perm: "comments.view" },
      { href: "/abuse", label: "Abuse flags", Icon: Ban, badge: "flags", perm: "abuse.view" },
      { href: "/feedback", label: "Feedback", Icon: MessageSquareWarning, perm: "feedback.view" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/users", label: "Users", Icon: Users, perm: "users.view" },
      { href: "/communities", label: "Communities", Icon: UsersRound, perm: "communities.view" },
    ],
  },
  {
    label: "Money & ads",
    items: [
      { href: "/ads-overview", label: "Ads overview", Icon: BarChart3, perm: "ads.manage" },
      { href: "/ad-review", label: "Live ads", Icon: Megaphone, perm: "ads.review" },
      { href: "/ad-reports", label: "Ad reports", Icon: ShieldAlert, perm: "ads.review" },
      { href: "/advertisers", label: "Advertisers", Icon: Store, perm: "ads.manage" },
      { href: "/payouts", label: "Payouts & KYC", Icon: Banknote, perm: "payouts.view" },
      { href: "/payments", label: "Payments", Icon: CreditCard, perm: "finance.view" },
      { href: "/revenue", label: "Revenue", Icon: LineChart, perm: "finance.view" },
    ],
  },
  {
    label: "Security",
    items: [
      { href: "/identity", label: "Identity lookup", Icon: Fingerprint, admin: true },
      { href: "/audit-logs", label: "Audit log", Icon: ScrollText, perm: "audit.view" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/media", label: "Media library", Icon: ImageIcon, perm: "media.view" },
      { href: "/settings", label: "Site settings", Icon: Settings, perm: "settings.manage" },
      { href: "/account", label: "My account", Icon: UserCog },
    ],
  },
];

export function AppSidebar({ online }: { online: number | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, isAdmin, can, logout } = useAdminAuth();
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => get<{ totals: { pending_reports: number; flagged_posts: number } }>("/admin/stats"),
    refetchInterval: 60_000,
    enabled: can("dashboard.view"),
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-2 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning"><Shield className="size-4" /></div>
          <div className="leading-tight group-data-[collapsible=icon]:hidden">
            <div className="font-heading font-bold">DualSphere</div>
            <div className="text-[11px] text-muted-foreground">Control panel</div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => {
          const items = g.items.filter((i) => (!i.admin || isAdmin) && (!i.perm || can(i.perm)));
          if (!items.length) return null;
          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((i) => {
                    const count = i.badge === "reports" ? stats?.totals.pending_reports : i.badge === "flags" ? stats?.totals.flagged_posts : 0;
                    return (
                      <SidebarMenuItem key={i.href}>
                        <SidebarMenuButton asChild isActive={i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)} tooltip={i.label}>
                          <Link href={i.href}><i.Icon /> <span>{i.label}</span></Link>
                        </SidebarMenuButton>
                        {!!count && <SidebarMenuBadge className="bg-destructive/20 text-destructive">{count}</SidebarMenuBadge>}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Open site">
              <a href={FRONTEND} target="_blank" rel="noreferrer"><ExternalLink /> <span>Open site</span></a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {online !== null && (
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={`${online} online`}>
                <Activity className="text-anon" /> <span>{online} connected now</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        {me && (
          <div className="flex items-center gap-2 rounded-lg border p-2 group-data-[collapsible=icon]:hidden">
            <MiniAvatar src={me.avatarUrl} name={me.displayName} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{me.displayName}</div>
              <RolePill role={me.role} />
            </div>
            <button
              onClick={async () => { await logout(); router.replace("/login"); }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Log out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
