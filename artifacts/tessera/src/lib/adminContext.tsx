import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface AdminState {
  isAdmin: boolean;
  configured: boolean;
  loading: boolean;
  authenticate: (key: string) => Promise<boolean>;
  logout: () => Promise<void>;
  stealthMode: boolean;
  toggleStealth: () => void;
  adminMode: boolean;
}

interface SessionStatus {
  ok?: boolean;
  configured?: boolean;
  authenticated?: boolean;
  expiresAt?: number;
}

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
const SESSION_URL = `${BASE}api/admin/session`;
const SESSION_STATUS_URL = `${SESSION_URL}/status`;
const SESSION_LOGOUT_URL = `${SESSION_URL}/logout`;

const AdminContext = createContext<AdminState>({
  isAdmin: false,
  configured: false,
  loading: true,
  authenticate: async () => false,
  logout: async () => {},
  stealthMode: false,
  toggleStealth: () => {},
  adminMode: false,
});

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stealthMode, setStealthMode] = useState(false);

  const applyAdminTheme = useCallback((active: boolean) => {
    const existing = document.getElementById("tessera-admin-theme");
    if (!active) {
      existing?.remove();
      return;
    }
    const style = existing instanceof HTMLStyleElement ? existing : document.createElement("style");
    style.id = "tessera-admin-theme";
    style.textContent = `:root { --admin-active: 1; }
      .admin-mode-indicator { color: #7ef0d4 !important; text-shadow: 0 0 12px rgba(126, 240, 212, 0.45); }
      .admin-mode-font { font-family: 'Fragment Mono', ui-monospace, monospace !important; color: #7ef0d4 !important; }
      .admin-mode-caret { caret-color: #7ef0d4 !important; }
      .admin-mode-sidebar-title { background: linear-gradient(135deg, #f3efe6, #7ef0d4) !important; -webkit-background-clip: text !important; -webkit-text-fill-color: transparent !important; background-clip: text !important; }
      [data-testid="mobile-nav"], [data-testid="mobile-bottom-nav"] { border-top-color: rgba(126, 240, 212, 0.25) !important; box-shadow: 0 -4px 20px rgba(126, 240, 212, 0.08); }
      [data-testid="sidebar"] { border-right-color: rgba(126, 240, 212, 0.15) !important; }
      [data-testid="admin-key-section"] { border-color: rgba(126, 240, 212, 0.4) !important; box-shadow: 0 0 20px rgba(126, 240, 212, 0.1); }`;
    if (!existing) document.head.appendChild(style);
  }, []);

  const checkStatus = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(SESSION_STATUS_URL, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Session status unavailable");
      const data = (await response.json()) as SessionStatus;
      const active = Boolean(
        data.configured && data.authenticated &&
        typeof data.expiresAt === "number" && data.expiresAt > Date.now(),
      );
      setConfigured(Boolean(data.configured));
      setIsAdmin(active);
      if (!active) setStealthMode(false);
      applyAdminTheme(active);
      return active;
    } catch {
      setConfigured(false);
      setIsAdmin(false);
      setStealthMode(false);
      applyAdminTheme(false);
      return false;
    }
  }, [applyAdminTheme]);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      await checkStatus();
      if (!cancelled) setLoading(false);
    };
    void probe();
    const interval = window.setInterval(() => { void checkStatus(); }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [checkStatus]);

  const authenticate = useCallback(async (key: string): Promise<boolean> => {
    let value = key.trim();
    if (!value) return false;
    setLoading(true);
    try {
      const response = await fetch(SESSION_URL, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
      const data = (await response.json().catch(() => ({}))) as SessionStatus;
      const active = Boolean(
        response.ok && data.authenticated &&
        typeof data.expiresAt === "number" && data.expiresAt > Date.now(),
      );
      setConfigured(response.status !== 503 && data.configured !== false);
      setIsAdmin(active);
      setStealthMode(false);
      applyAdminTheme(active);
      return active;
    } catch {
      setIsAdmin(false);
      setStealthMode(false);
      applyAdminTheme(false);
      return false;
    } finally {
      value = "";
      setLoading(false);
    }
  }, [applyAdminTheme]);

  const logout = useCallback(async () => {
    setIsAdmin(false);
    setStealthMode(false);
    applyAdminTheme(false);
    try {
      await fetch(SESSION_LOGOUT_URL, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch { /* local UI is locked even if the server cannot be reached */ }
  }, [applyAdminTheme]);

  const toggleStealth = useCallback(() => {
    if (isAdmin) setStealthMode(previous => !previous);
  }, [isAdmin]);

  return (
    <AdminContext.Provider value={{
      isAdmin,
      configured,
      loading,
      authenticate,
      logout,
      stealthMode,
      toggleStealth,
      adminMode: isAdmin,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
