"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, ExternalLink, HardDrive, Trash2, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Ago, bytes, FilterChips, PageHeader, Pagination, Spinner } from "@/components/admin/common";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { del, errorMessage, get } from "@/lib/api";
import type { MediaItem } from "@/lib/types";
import { useAdminAuth } from "@/providers/providers";

export default function MediaPage() {
  const { can } = useAdminAuth();
  const qc = useQueryClient();
  const [kind, setKind] = useState<"all" | "image" | "video">("all");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<MediaItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["media", kind, page],
    queryFn: () => get<{ items: MediaItem[]; total: number; totalBytes: number; driver: "r2" | "local" }>(`/admin/media?page=${page}&limit=24${kind !== "all" ? `&kind=${kind}` : ""}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Media library" desc="Images and videos uploaded by members.">
        {data && (
          <span className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
            {data.driver === "r2" ? <Cloud className="size-4 text-orange-400" /> : <HardDrive className="size-4" />}
            {data.driver === "r2" ? "Cloudflare R2" : "Local disk"} · {bytes(data.totalBytes)}
          </span>
        )}
        <FilterChips value={kind} onChange={(v) => { setKind(v); setPage(1); }} options={[{ v: "all", label: "All" }, { v: "image", label: "Images" }, { v: "video", label: "Videos" }]} />
      </PageHeader>
      {isLoading && <Spinner className="mx-auto mt-10 size-6" />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {data?.items.map((m) => (
          <div key={m.id} className="group overflow-hidden rounded-xl border bg-card">
            <div className="relative aspect-square bg-muted">
              {m.kind === "video" ? (
                <>
                  <video src={m.url} className="size-full object-cover" muted preload="metadata" />
                  <Video className="absolute top-2 left-2 size-4 drop-shadow" />
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" loading="lazy" className="size-full object-cover" />
              )}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                <Button asChild size="icon-sm" variant="secondary"><a href={m.url} target="_blank" rel="noreferrer" aria-label="Open"><ExternalLink /></a></Button>
                {can("media.delete") && <Button size="icon-sm" variant="destructive" onClick={() => setDeleting(m)} aria-label="Delete"><Trash2 /></Button>}
              </div>
            </div>
            <div className="space-y-1 p-2 text-xs">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px] capitalize">{m.purpose}</Badge>
                <span className="text-muted-foreground">{bytes(m.size)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{m.status}</span>
                <Ago date={m.createdAt} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {data && data.items.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">No media yet.</p>}
      {data && data.total > 24 && <div className="mt-4 rounded-xl border bg-card"><Pagination page={page} total={data.total} limit={24} onPage={setPage} /></div>}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file permanently?</AlertDialogTitle>
            <AlertDialogDescription>It is removed from storage and detached from any post or profile. This is audit-logged.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => del(`/admin/media/${deleting!.id}`).then(() => { toast.success("File deleted"); qc.invalidateQueries({ queryKey: ["media"] }); }).catch((e) => toast.error(errorMessage(e)))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
