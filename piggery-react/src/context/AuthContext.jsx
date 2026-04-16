// src/context/AuthContext.jsx

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe;

    // ✅ FIX: wait for redirect result FIRST, then start the auth listener.
    // Previously if getRedirectResult threw, setLoading(false) never ran → blank page.
    const init = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("✅ Google redirect login success:", result.user.email);
        }
      } catch (error) {
        // Common on mobile: auth/null-user — safe to ignore
        console.warn("ℹ️ getRedirectResult:", error.code ?? error.message);
      } finally {
        // ✅ Always runs — even if redirect threw — so we never stay blank
        unsubscribe = onAuthStateChanged(auth, (u) => {
          console.log("👤 Auth state changed:", u?.email ?? "signed out");
          setUser(u);
          setLoading(false);
        });
      }
    };

    init();

    // ✅ Emergency fallback: if Firebase hangs for 15 s, stop showing blank
    const timeout = setTimeout(() => {
      console.warn("⚠️ Auth init timeout — forcing loading=false");
      setLoading(false);
    }, 15000);

    return () => {
      unsubscribe?.();
      clearTimeout(timeout);
    };
  }, []);

  // Google login (redirect — mobile safe, no popup)
  const loginWithGoogle = async () => {
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      console.error("Google login failed:", error);
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {/* ✅ Show nothing (not blank div) while Firebase restores session */}
      {loading ? null : children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
