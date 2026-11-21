"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { errorMessage, get, put } from "@/lib/api";
import type { AdminUserDetail, Permission, PermissionInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Spinner } from "./common";

type Catalogue = {
  permissions: PermissionInfo[];
  defaults: Permission[];
  adminOnly: string[];
};

/**
 * Admin-only: choose exactly what a moderator can do. Grouped checklist, "Select all", "Reset to defaults".
 * Changes apply on the moderator's next request (their panel refreshes live).
 */
export function PermissionsEditor({ user }: { user: AdminUserDetail }) {
  const qc = useQueryClient();
  const { data: cat } = useQuery({
    queryKey: ["permissions-catalogue"],
    queryFn: () => get<Catalogue>("/admin/permissions"),
    staleTime: Infinity,
  });
  const current = user.permissions ?? [];
  const [draft, setDraft] = useState<Set<Permission> | null>(null);
  const [open, setOpen] = useState(false); // collapsed by default so the side panel stays short
  const selected = draft ?? new Set(current);
  const dirty =
    draft !== null &&
    (draft.size !== current.length || current.some((p) => !draft.has(p)));

  const save = useMutation({
    mutationFn: (permissions: Permission[] | null) =>
      put<{ permissions: Permission[]; custom: boolean }>(
        `/admin/users/${user.id}/permissions`,
        { permissions },
      ),
    onSuccess: (_r, permissions) => {
      toast.success(
        permissions === null
          ? "Reset to default moderator permissions"
          : "Permissions saved",
      );
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["user", user.id] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!cat) return <Spinner className="size-5" />;
  const groups = [...new Set(cat.permissions.map((p) => p.group))];
  const toggle = (k: Permission, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(k);
    else next.delete(k);
    setDraft(next);
  };

  return (
    <div className="rounded-xl border">
      {/* Header: click to show / hide the permission list */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl p-3 text-left transition-colors hover:bg-accent/50"
      >
        <ShieldCheck className="size-4 shrink-0 text-cyan-400" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            Moderator permissions
          </span>
          <span className="block text-xs text-muted-foreground">
            {selected.size} of {cat.permissions.length} allowed ·{" "}
            {user.customPermissions && !draft
              ? "custom"
              : !draft
                ? "default set"
                : "unsaved changes"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t p-3">
              <div className="flex justify-end gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDraft(new Set(cat.permissions.map((p) => p.key)))
                  }
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDraft(new Set())}
                >
                  None
                </Button>
              </div>

              {groups.map((g) => (
                <div key={g}>
                  <p className="mb-1 text-[12px] font-semibold text-muted-foreground">
                    {g}
                  </p>
                  <div className="space-y-0.5">
                    {cat.permissions
                      .filter((p) => p.group === g)
                      .map((p) => {
                        const on = selected.has(p.key);
                        return (
                          <label
                            key={p.key}
                            className={cn(
                              "flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-accent",
                              on && "bg-accent/40",
                            )}
                          >
                            <Checkbox
                              checked={on}
                              onCheckedChange={(v) => toggle(p.key, v === true)}
                              className="mt-0.5"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">
                                {p.label}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {p.desc}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              ))}

              <div className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                <p className="mb-1 flex items-center gap-1 font-semibold text-foreground">
                  <Lock className="size-3" /> Always admin-only
                </p>
                {cat.adminOnly.join(" · ")}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={!dirty || save.isPending}
                  onClick={() => save.mutate([...selected])}
                >
                  {save.isPending && <Spinner />} Save permissions
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    save.isPending || (!user.customPermissions && !draft)
                  }
                  onClick={() => save.mutate(null)}
                >
                  <RotateCcw /> Defaults
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
