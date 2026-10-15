import { createContext, useContext, useState, useEffect, useCallback } from "react";

interface AdminState {
  isAdmin: boolean;
  configured: boolean;
  loading: boolean;
  authenticate: (key: string) => Promise<boolean>;
  logout: () => void;
  stealthMode: boolean;
  toggleStealth: () => void;
  adminMode: boolean;
}

const AdminContext = createContext<AdminState>({
  isAdmin: false,
  configured: false,
  loading: true,
  authenticate: async () => false,
  logout: () => {},
  stealthMode: false,
  toggleStealth: () => {},
  adminMode: false,
});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stealthMode, setStealthMode] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/session/status", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Unable to verify owner session");
      const data = await res.json();
      const authenticated = data.authenticated === true;
      setIsAdmin(authenticated);
      setAdminMode(authenticated);
      setConfigured(data.configured === true);
      applyAdminTheme(authenticated);
      return authenticated;
    } catch {
      setIsAdmin(false);
      setAdminMode(false);
      applyAdminTheme(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      setLoading(true);
      await checkStatus();
      if (!cancelled) setLoading(false);
    };
    const handleSessionChange = () => { void refresh(); };
    void refresh();
    window.addEventListener("tessera-admin-session-changed", handleSessionChange);
    return () => {
      cancelled = true;
      window.removeEventListener("tessera-admin-session-changed", handleSessionChange);
    };
  }, [checkStatus]);

  const authenticate = useCallback(async (key: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: key.trim() }),
      });
      if (!res.ok) {
        return false;
      }
      const authenticated = await checkStatus();
      if (authenticated) {
        setIsAdmin(true);
        setAdminMode(true);
        applyAdminTheme(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [checkStatus]);

  const applyAdminTheme = (active: boolean) => {
    let style = document.getElementById("tessera-admin-theme") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "tessera-admin-theme";
      document.head.appendChild(style);
    }
    if (active) {
      style.textContent = `:root { --admin-active: 1; }
      .admin-mode-indicator { 
        color: #7c3aed !important;
        text-shadow: 0 0 12px rgba(124, 58, 237, 0.6);
      }
      .admin-mode-font {
        font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace !important;
        color: #8b5cf6 !important;
        text-shadow: 0 0 8px rgba(139, 92, 246, 0.35);
      }
      .admin-mode-caret {
        caret-color: #8b5cf6 !important;
      }
      .admin-mode-sidebar-title {
        background: linear-gradient(135deg, #a78bfa, #8b5cf6) !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
      }
      [data-testid="mobile-nav"], [data-testid="mobile-bottom-nav"] {
        border-top-color: rgba(139, 92, 246, 0.25) !important;
        box-shadow: 0 -4px 20px rgba(139, 92, 246, 0.08);
      }
      [data-testid="sidebar"] {
        border-right-color: rgba(139, 92, 246, 0.15) !important;
      }
      [data-testid="admin-key-section"] {
        border-color: rgba(139, 92, 246, 0.4) !important;
        box-shadow: 0 0 20px rgba(139, 92, 246, 0.1);
      }`;
    } else {
      style.textContent = "";
    }
  };

  useEffect(() => {
    applyAdminTheme(isAdmin);
  }, [isAdmin]);

  const logout = () => {
    void fetch("/api/admin/session/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {}).finally(() => {
      window.dispatchEvent(new Event("tessera-admin-session-changed"));
    });
    setIsAdmin(false);
    setStealthMode(false);
    setAdminMode(false);
    applyAdminTheme(false);
  };

  const toggleStealth = () => {
    if (isAdmin) {
      setStealthMode(prev => !prev);
    }
  };

  return (
    <AdminContext.Provider value={{ isAdmin, configured, loading, authenticate, logout, stealthMode, toggleStealth, adminMode }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
