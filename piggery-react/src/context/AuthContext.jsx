// src/context/AuthContext.jsx

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  signInWithRedirect,
  getRedirectResult
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase"; // ⚠️ make sure path is correct

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🔥 Handle Google redirect result (VERY IMPORTANT)
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("✅ Google login success:", result.user);
        }
      })
      .catch((error) => {
        console.error("❌ Redirect error:", error);
      });

    // 🔥 Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log("👤 Auth state changed:", u);
      setUser(u);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 🔥 Google login (redirect for mobile + Vercel)
  const loginWithGoogle = async () => {
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      console.error("Google login failed:", error);
    }
  };

  // 🔥 Logout
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Hook
export const useAuth = () => useContext(AuthContext);
