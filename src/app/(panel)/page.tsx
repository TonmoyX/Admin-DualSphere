"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Ban, Flag, HardDrive, Heart, KeyRound, MessageSquare, Send, UserPlus, Users, VenetianMask, UserRound } from "lucide-react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Ago, bytes, humanize, PageHeader, Spinner } from "@/components/admin/common";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { get } from "@/lib/api";

interface Stats {
  totals: Record<string, number> & { storage: string };
  series: { date: string; signups: number; identity: number; anonymous: number; comments: number }[];
  recentActivity: { id: number; action: string; actor_role: string | null; target_type: string | null; created_at: string }[];
}

const postsChart = { identity: { label: "Identity", color: "var(--chart-1)" }, anonymous: { label: "Anonymous", color: "var(--chart-2)" } } satisfies ChartConfig;
const usersChart = { signups: { label: "Sign-ups", color: "var(--chart-3)" }, comments: { label: "Comments", color: "var(--chart-4)" } } satisfies ChartConfig;

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["stats"], queryFn: () => get<Stats>("/admin/stats"), refetchInterval: 30_000 });
  if (isLoading || !data) return <Spinner className="mx-auto mt-20 size-6" />;
  const t = data.totals;

  const cards = [
    { label: "Users", value: t.users, sub: `+${t.users_today} today`, Icon: Users, color: "text-identity" },
    { label: "Identity posts", value: t.identity_posts, sub: `${t.posts_today} posts today`, Icon: UserRound, color: "text-identity" },
    { label: "Anonymous posts", value: t.anon_posts, sub: `${t.posts ? Math.round((t.anon_posts / t.posts) * 100) : 0}% of all posts`, Icon: VenetianMask, color: "text-anon" },
    { label: "Pending reports", value: t.pending_reports, sub: "Awaiting review", Icon: Flag, color: t.pending_reports ? "text-warning" : "text-muted-foreground", href: "/reports" },
    { label: "Comments", value: t.comments, sub: `${t.likes.toLocaleString()} likes total`, Icon: MessageSquare, color: "text-cyan-300" },
    { label: "Direct messages", value: t.messages, sub: `${t.conversations} conversations`, Icon: Send, color: "text-violet-400" },
    { label: "Flagged posts", value: t.flagged_posts, sub: `${t.removed_posts} removed`, Icon: AlertTriangle, color: t.flagged_posts ? "text-destructive" : "text-muted-foreground", href: "/abuse" },
    { label: "Banned users", value: t.banned, sub: `${t.active_sessions} active sessions`, Icon: Ban, color: "text-destructive" },
    { label: "Media storage", value: bytes(t.media_bytes), sub: t.storage === "r2" ? "Cloudflare R2" : "Local disk (dev)", Icon: HardDrive, color: "text-pink-400" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" desc="Platform health at a glance. Updates live.">
        <span className="flex items-center gap-2 rounded-full border border-anon/25 bg-anon/10 px-3 py-1 text-xs text-anon">
          <span className="size-1.5 animate-pulse rounded-full bg-anon" /> {t.online} connected
        </span>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => {
          const inner = (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="h-full rounded-xl border bg-card p-4 transition-colors hover:border-primary/30">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                {c.label}
                <c.Icon className={`size-4 ${c.color}`} />
              </div>
              <div className="mt-2 font-heading text-3xl font-bold tabular-nums">{typeof c.value === "number" ? c.value.toLocaleString() : c.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>
            </motion.div>
          );
          return c.href ? <Link key={c.label} href={c.href}>{inner}</Link> : <div key={c.label}>{inner}</div>;
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Posts per day</CardTitle>
            <CardDescription>Identity vs anonymous, last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={postsChart} className="h-64 w-full">
              <BarChart data={data.series}>
                <CartesianGrid vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="identity" stackId="a" fill="var(--color-identity)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="anonymous" stackId="a" fill="var(--color-anonymous)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Growth & engagement</CardTitle>
            <CardDescription>Sign-ups and comments, last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={usersChart} className="h-64 w-full">
              <AreaChart data={data.series}>
                <CartesianGrid vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area dataKey="signups" type="monotone" fill="var(--color-signups)" fillOpacity={0.2} stroke="var(--color-signups)" />
                <Area dataKey="comments" type="monotone" fill="var(--color-comments)" fillOpacity={0.15} stroke="var(--color-comments)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="size-4" /> Recent audited activity</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {data.recentActivity.map((a) => {
            const Icon = a.action.includes("IDENTITY") ? KeyRound : a.action.includes("SIGNUP") ? UserPlus : a.action.includes("LIKE") ? Heart : Activity;
            return (
              <div key={a.id} className="flex items-center gap-3 py-2 text-sm">
                <Icon className={`size-4 ${a.action.includes("IDENTITY") ? "text-warning" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium">{humanize(a.action)}</span>
                <span className="text-muted-foreground">{a.actor_role ?? "system"}{a.target_type ? ` → ${a.target_type}` : ""}</span>
                <span className="ml-auto"><Ago date={a.created_at} /></span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
