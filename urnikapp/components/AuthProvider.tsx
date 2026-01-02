import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PublicUser } from "@/lib/authlib";
import { loadUser, saveUser, clearUser } from "@/lib/authStore";

type AuthCtx = {
  user: PublicUser | null;
  isReady: boolean;
  setLoggedIn: (u: PublicUser) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await loadUser();
      setUser(u);
      setIsReady(true);
    })();
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      isReady,
      setLoggedIn: async (u) => {
        setUser(u);
        await saveUser(u);
      },
      logout: async () => {
        setUser(null);
        await clearUser();
      },
    }),
    [user, isReady]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
