"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Globe, Save, Shield, ToggleLeft, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Spinner } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, get, put } from "@/lib/api";
import type { Settings } from "@/lib/types";

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="max-w-md">
        <Label className="text-sm font-medium">{label}</Label>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      </div>
      <div className="sm:w-72 sm:shrink-0 sm:text-right">{children}</div>
    </div>
  );
}

function Num({ value, onChange, min, max, step = 1 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }) {
  return <Input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className="sm:ml-auto sm:w-32" />;
}

export default function SettingsPage() {
  const { data } = useQuery({ queryKey: ["admin-settings"], queryFn: () => get<Settings>("/admin/settings") });
  if (!data) return <Spinner className="mx-auto mt-20 size-6" />;
  return <SettingsForm saved={data} />;
}

function SettingsForm({ saved }: { saved: Settings }) {
  const qc = useQueryClient();
  const [s, setS] = useState<Settings>(() => structuredClone(saved));
  const [word, setWord] = useState("");

  const save = useMutation({
    mutationFn: (patch: Partial<Settings>) => put<Settings>("/admin/settings", patch),
    onSuccess: (next) => { qc.setQueryData(["admin-settings"], next); toast.success("Saved. Changes are live on the site."); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const set = <K extends keyof Settings>(section: K, patch: Partial<Settings[K]>) => setS({ ...s, [section]: { ...s[section], ...patch } });
  const dirty = (k: keyof Settings) => JSON.stringify(s[k]) !== JSON.stringify(saved[k]);
  const saveBar = (k: keyof Settings) => (
    <div className="flex justify-end pt-4">
      <Button onClick={() => save.mutate({ [k]: s[k] } as Partial<Settings>)} disabled={!dirty(k) || save.isPending}>
        {save.isPending ? <Spinner /> : <Save />} Save {k}
      </Button>
    </div>
  );

  return (
    <>
      <PageHeader title="Site settings" desc="Full control over the public site. Saved changes are pushed to every open browser instantly." />
      <Tabs defaultValue="site">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="site"><Globe /> Branding</TabsTrigger>
          <TabsTrigger value="features"><ToggleLeft /> Features</TabsTrigger>
          <TabsTrigger value="limits"><Gauge /> Limits</TabsTrigger>
          <TabsTrigger value="moderation"><Shield /> Moderation</TabsTrigger>
        </TabsList>

        <TabsContent value="site" className="rounded-xl border bg-card px-5 py-2">
          <Row label="Site name"><Input value={s.site.name} maxLength={40} onChange={(e) => set("site", { name: e.target.value })} /></Row>
          <Row label="Tagline" desc="Hero headline on the landing page."><Input value={s.site.tagline} maxLength={120} onChange={(e) => set("site", { tagline: e.target.value })} /></Row>
          <Row label="Description" desc="Landing page intro and SEO description."><Textarea value={s.site.description} maxLength={400} onChange={(e) => set("site", { description: e.target.value })} /></Row>
          <Row label="Footer text"><Input value={s.site.footerText} maxLength={200} onChange={(e) => set("site", { footerText: e.target.value })} /></Row>
          <Row label="Announcement banner" desc="Shown at the top of every page.">
            <div className="flex items-center gap-2 sm:justify-end">
              <Switch checked={s.site.announcement.enabled} onCheckedChange={(v) => set("site", { announcement: { ...s.site.announcement, enabled: v } })} />
              <span className="text-sm">{s.site.announcement.enabled ? "Visible" : "Hidden"}</span>
            </div>
          </Row>
          <Row label="Announcement text"><Textarea value={s.site.announcement.text} maxLength={280} onChange={(e) => set("site", { announcement: { ...s.site.announcement, text: e.target.value } })} /></Row>
          <Row label="Announcement style">
            <Select value={s.site.announcement.variant} onValueChange={(v) => set("site", { announcement: { ...s.site.announcement, variant: v as Settings["site"]["announcement"]["variant"] } })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info (violet)</SelectItem>
                <SelectItem value="success">Success (green)</SelectItem>
                <SelectItem value="warning">Warning (amber)</SelectItem>
                <SelectItem value="danger">Danger (red)</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Announcement link" desc="Optional https:// URL."><Input value={s.site.announcement.link ?? ""} placeholder="https://…" onChange={(e) => set("site", { announcement: { ...s.site.announcement, link: e.target.value || null } })} /></Row>
          {saveBar("site")}
        </TabsContent>

        <TabsContent value="features" className="rounded-xl border bg-card px-5 py-2">
          {([
            ["registrationEnabled", "Open registration", "Allow new accounts to sign up."],
            ["anonymousPostingEnabled", "Anonymous posting", "Turn the anonymous mode on or off platform-wide."],
            ["commentsEnabled", "Comments", "Allow commenting and replies."],
            ["mediaUploadsEnabled", "Media uploads", "Allow image/video uploads (Cloudflare R2)."],
            ["messagingEnabled", "Direct messages", "Allow members to send private messages and create group chats."],
            ["videoUploadsEnabled", "Video uploads", "Allow video attachments on posts."],
            ["requireEmailVerification", "Require verified email", "Members must verify their email before posting or commenting."],
            ["maintenanceMode", "Maintenance mode", "Non-staff see a maintenance page and cannot post."],
          ] as const).map(([k, label, desc]) => (
            <Row key={k} label={label} desc={desc}>
              <Switch checked={s.features[k]} onCheckedChange={(v) => set("features", { [k]: v } as Partial<Settings["features"]>)} />
            </Row>
          ))}
          <Row label="Maintenance message"><Textarea value={s.features.maintenanceMessage} maxLength={400} onChange={(e) => set("features", { maintenanceMessage: e.target.value })} /></Row>
          {saveBar("features")}
        </TabsContent>

        <TabsContent value="limits" className="rounded-xl border bg-card px-5 py-2">
          <Row label="Max friends per account" desc="Nobody can have more friends than this. Sending or accepting a request past the limit is blocked."><Num value={s.limits.maxFriends} min={1} max={100000} onChange={(n) => set("limits", { maxFriends: n })} /></Row>
          <Row label="Max post length" desc="Characters."><Num value={s.limits.maxPostLength} min={50} max={5000} onChange={(n) => set("limits", { maxPostLength: n })} /></Row>
          <Row label="Max comment length"><Num value={s.limits.maxCommentLength} min={20} max={500} onChange={(n) => set("limits", { maxCommentLength: n })} /></Row>
          <Row label="Attachments per post"><Num value={s.limits.maxMediaPerPost} min={0} max={10} onChange={(n) => set("limits", { maxMediaPerPost: n })} /></Row>
          <Row label="Max image size (MB)"><Num value={s.limits.maxImageMb} min={1} max={50} onChange={(n) => set("limits", { maxImageMb: n })} /></Row>
          <Row label="Max video size (MB)"><Num value={s.limits.maxVideoMb} min={1} max={500} onChange={(n) => set("limits", { maxVideoMb: n })} /></Row>
          <Row label="Anonymous account-age gate (hours)" desc="New accounts must wait this long before posting anonymously. 0 disables."><Num value={s.limits.anonAccountAgeHours} min={0} max={720} onChange={(n) => set("limits", { anonAccountAgeHours: n })} /></Row>
          <Row label="Global requests / 15 min / IP"><Num value={s.limits.globalRequestsPer15Min} min={20} max={10000} onChange={(n) => set("limits", { globalRequestsPer15Min: n })} /></Row>
          <Row label="Posts / hour / user"><Num value={s.limits.postsPerHour} min={1} max={500} onChange={(n) => set("limits", { postsPerHour: n })} /></Row>
          <Row label="Anonymous posts / hour / user" desc="Kept stricter than identity posting."><Num value={s.limits.anonPostsPerHour} min={1} max={500} onChange={(n) => set("limits", { anonPostsPerHour: n })} /></Row>
          <Row label="Messages / minute / user" desc="Direct-message send rate limit."><Num value={s.limits.messagesPerMinute} min={1} max={600} onChange={(n) => set("limits", { messagesPerMinute: n })} /></Row>
          <Row label="Comments / hour / user"><Num value={s.limits.commentsPerHour} min={1} max={1000} onChange={(n) => set("limits", { commentsPerHour: n })} /></Row>
          {saveBar("limits")}
        </TabsContent>

        <TabsContent value="moderation" className="rounded-xl border bg-card px-5 py-2">
          <Row label="Banned words" desc="Posts containing these get flagged as spam:keyword.">
            <div className="space-y-2">
              <form onSubmit={(e) => { e.preventDefault(); const w = word.trim().toLowerCase(); if (w && !s.moderation.bannedWords.includes(w)) set("moderation", { bannedWords: [...s.moderation.bannedWords, w] }); setWord(""); }} className="flex gap-2">
                <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Add word…" />
                <Button type="submit" variant="outline">Add</Button>
              </form>
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                {s.moderation.bannedWords.map((w) => (
                  <span key={w} className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    {w}
                    <button onClick={() => set("moderation", { bannedWords: s.moderation.bannedWords.filter((x) => x !== w) })} aria-label={`Remove ${w}`}><X className="size-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          </Row>
          <Row label="Auto-hide threshold" desc="Hide a post automatically after this many reports. 0 disables."><Num value={s.moderation.autoHideReportThreshold} min={0} max={1000} onChange={(n) => set("moderation", { autoHideReportThreshold: n })} /></Row>
          <Row label="Duplicate window (minutes)" desc="Identical content is rejected within this window."><Num value={s.moderation.duplicateWindowMinutes} min={0} max={1440} onChange={(n) => set("moderation", { duplicateWindowMinutes: n })} /></Row>
          <Row label="Similarity threshold" desc="0.5–1.0. Posts at least this similar to a recent one get flagged."><Num value={s.moderation.similarityThreshold} min={0.5} max={1} step={0.01} onChange={(n) => set("moderation", { similarityThreshold: n })} /></Row>
          <Row label="Require 2FA for identity lookups" desc="Strongly recommended. Admins must enter a fresh authenticator code per lookup.">
            <Switch checked={s.moderation.requireMfaForIdentityLookup} onCheckedChange={(v) => set("moderation", { requireMfaForIdentityLookup: v })} />
          </Row>
          {saveBar("moderation")}
        </TabsContent>
      </Tabs>
    </>
  );
}
