import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";
import { API_BASE_URL } from "./config";
import { BannedUserModal } from "./BannedUserModal.jsx";

const AuthContext = createContext(null);
const STORAGE_KEY = "sand24_auth_token";

function isBannedError(err) {
  return err?.response?.status === 403 && err?.response?.data?.code === "USER_BANNED";
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(STORAGE_KEY)));
  const [bannedModalOpen, setBannedModalOpen] = useState(false);

  const clearSession = useCallback(() => {
    setToken("");
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    delete axios.defaults.headers.common.Authorization;
  }, []);

  const showBannedModal = useCallback(() => {
    setBannedModalOpen(true);
    clearSession();
  }, [clearSession]);

  /** Keep axios Authorization in sync before any child effects (e.g. shop summary) run. */
  useLayoutEffect(() => {
    if (!token) {
      delete axios.defaults.headers.common.Authorization;
      return;
    }
    localStorage.setItem(STORAGE_KEY, token);
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  }, [token]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/auth/me`);
        if (!cancelled && data?.user) setUser(data.user);
      } catch (err) {
        if (!cancelled) {
          if (isBannedError(err)) {
            setBannedModalOpen(true);
          }
          clearSession();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, clearSession]);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const setSession = useCallback((newToken, nextUser) => {
    setToken(newToken);
    setUser(nextUser);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return null;
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/auth/me`);
      if (data?.user) {
        setUser(data.user);
        return data.user;
      }
    } catch {
      /* ignore */
    }
    return null;
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      setSession,
      logout,
      setToken,
      showBannedModal,
      refreshUser,
    }),
    [token, user, loading, setSession, logout, showBannedModal, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <BannedUserModal open={bannedModalOpen} onClose={() => setBannedModalOpen(false)} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
