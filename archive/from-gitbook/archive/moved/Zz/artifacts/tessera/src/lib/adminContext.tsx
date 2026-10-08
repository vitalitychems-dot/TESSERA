import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { queryClient } from "./queryClient";

interface AdminState {
  isAdmin: boolean;
  configured: boolean;
  loading: boolean;
  authenticate: (key: string) => Promise<boolean>;
  logout: () => void;
  token: string;
  stealthMode: boolean;
  toggleStealth: () => void;
  adminMode: boolean;
  savedAdminKey: string;
  saveAdminKey: (key: string) => void;
  removeAdminKey: () => void;
}

const AdminContext = createContext<AdminState>({
  isAdmin: false, configured: false, loading: true, authenticate: async () => false,
  logout: () => {}, token: "", stealthMode: false, toggleStealth: () => {},
  adminMode: false, savedAdminKey: "", saveAdminKey: () => {}, removeAdminKey: () => {},
});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stealthMode, setStealthMode] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/session/status", { credentials: "include" });
      if (!response.ok) throw new Error("Session status unavailable");
      const status = await response.json();
      setConfigured(status.configured === true);
      setIsAdmin(status.authenticated === true);
      if (!status.authenticated) queryClient.clear();
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Remove old browser-persisted credentials. The owner key is never retained
    // in storage, a URL, a React context, or request headers after sign-in.
    ["t9_admin_token", "t9_saved_admin_key", "t9_sovereign_key", "t9_admin_mode"].forEach(k => localStorage.removeItem(k));
    void checkStatus();
    const timer = window.setInterval(() => void checkStatus(), 60_000);
    return () => window.clearInterval(timer);
  }, [checkStatus]);

  const authenticate = async (key: string) => {
    const response = await fetch("/api/admin/session", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: key }),
    });
    if (!response.ok) return false;
    // Verify that the browser actually accepted the HttpOnly cookie rather than
    // treating a successful credential check as an established browser session.
    const sessionResponse = await fetch("/api/admin/session/status", { credentials: "include" });
    if (!sessionResponse.ok) throw new Error("Could not verify the owner session.");
    const status = await sessionResponse.json();
    const authenticated = status.authenticated === true;
    if (!authenticated) throw new Error("The browser did not accept the session cookie. Open the preview in a new tab and retry.");
    setIsAdmin(authenticated);
    setConfigured(true);
    return authenticated;
  };

  const logout = async () => {
    const response = await fetch("/api/admin/session/logout", { method: "POST", credentials: "include" });
    if (!response.ok) throw new Error("Sign-out failed; please retry.");
    setIsAdmin(false);
    queryClient.clear();
  };

  return <AdminContext.Provider value={{
    isAdmin, configured, loading, authenticate, logout, token: "", stealthMode,
    toggleStealth: () => setStealthMode(v => !v), adminMode: isAdmin,
    // Legacy pages retain their interface without persisting owner credentials.
    savedAdminKey: "", saveAdminKey: () => {}, removeAdminKey: () => {},
  }}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  return useContext(AdminContext);
}
