"use client";

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError, get, post, refreshNow } from "@/lib/api";
import { reconnectSocket } from "@/lib/socket";
import type { Me, Permission } from "@/lib/types";

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  isAdmin: boolean;
  /** Admins can do everything; moderators only what an admin granted. */
  can: (p: Permission) => boolean;
  setMe: (m: Me | null) => void;
  refetch: () => Promise<unknown>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);

function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return (await get<{ user: Me }>("/auth/me")).user;
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
  });
  const setMe = useCallback(
    (m: Me | null) => {
      qc.setQueryData(["me"], m);
      reconnectSocket();
    },
    [qc],
  );
  const logout = useCallback(async () => {
    await post("/auth/logout").catch(() => {});
    qc.clear();
    setMe(null);
  }, [qc, setMe]);

  const loggedIn = !!data;
  useEffect(() => {
    if (!loggedIn) return;
    const t = setInterval(() => void refreshNow(), 10 * 60_000);
    return () => clearInterval(t);
  }, [loggedIn]);

  return (
    <Ctx.Provider
      value={{
        me: data ?? null,
        loading: isLoading,
        isAdmin: data?.role === "admin",
        can: (p) => data?.role === "admin" || !!data?.permissions?.includes(p),
        setMe,
        refetch,
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAdminAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdminAuth outside provider");
  return c;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: (n, err: unknown) => n < 1 && ![401, 403, 404].includes((err as { status?: number })?.status ?? 0),
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <TooltipProvider delayDuration={200}>
          {children}
          <ThemedToaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function ThemedToaster(props: React.ComponentProps<typeof Toaster>) {
  const [theme] = useTheme();
  return <Toaster theme={theme} {...props} />;
}
