import { createContext, useContext, useState, useCallback } from "react";

interface AdminState {
  isAdmin: boolean;
  configured: boolean;
  loading: boolean;
  authenticate: (key: string) => Promise<boolean>;
  logout: () => void;
  token: string;
}

const AdminContext = createContext<AdminState>({
  isAdmin: false,
  configured: true,
  loading: false,
  authenticate: async () => false,
  logout: () => {},
  token: "",
});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => !!localStorage.getItem("t9_admin_token"));
  const [token, setToken] = useState(() => localStorage.getItem("t9_admin_token") || "");

  const authenticate = useCallback(async (key: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/verify", {
        headers: { "x-admin-token": key },
      });
      if (res.ok) {
        localStorage.setItem("t9_admin_token", key);
        setToken(key);
        setIsAdmin(true);
        return true;
      }
    } catch {}
    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("t9_admin_token");
    setToken("");
    setIsAdmin(false);
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, configured: true, loading: false, authenticate, logout, token }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
