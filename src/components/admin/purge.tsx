"use client";

import { Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api";
import { useAdminAuth } from "@/providers/providers";
import { Spinner } from "./common";

/**
 * Admin-only "Delete permanently": erases the item from the database (files too) after a confirm.
 * Renders nothing for non-admins (the API checks the role as well).
 */
export function PurgeButton({
  what,
  details,
  onConfirm,
  onDone,
  size = "sm",
  label = "Delete permanently",
  iconOnly = false,
}: {
  what: string; // "this post", "this feedback"…
  details?: ReactNode; // what else goes with it
  onConfirm: () => Promise<unknown>;
  onDone?: () => void;
  size?: "xs" | "sm";
  label?: string;
  iconOnly?: boolean;
}) {
  const { isAdmin } = useAdminAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!isAdmin) return null;

  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      toast.success("Deleted permanently");
      setOpen(false);
      onDone?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {iconOnly ? (
        <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setOpen(true)} aria-label={label} title={label}>
          <Trash2 />
        </Button>
      ) : (
        <Button size={size} variant="destructive" onClick={() => setOpen(true)}><Trash2 /> {label}</Button>
      )}
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {what} permanently?</DialogTitle>
            <DialogDescription>It&apos;s erased from the database and can&apos;t be restored. The deletion is recorded in the audit log.</DialogDescription>
          </DialogHeader>
          {details && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">{details}</div>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={run} disabled={busy}>{busy ? <Spinner /> : <Trash2 />} Delete permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
