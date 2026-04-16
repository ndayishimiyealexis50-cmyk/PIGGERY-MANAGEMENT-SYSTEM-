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

    const init = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("✅ Google redirect login success:", result.user.email);
        }
      } catch (error) {
        console.warn("ℹ️ getRedirectResult:", error.code ?? error.message);
      } finally {
        unsubscribe = onAuthStateChanged(auth, (u) => {
          console.log("👤 Auth state changed:", u?.email ?? "signed out");
          setUser(u);
          setLoading(false);
        });
      }
    };

    init();

    // ✅ Reduced from 15s to 5s
    const timeout = setTimeout(() => {
      console.warn("⚠️ Auth init timeout — forcing loading=false");
      setLoading(false);
    }, 5000);

    return () => {
      unsubscribe?.();
      clearTimeout(timeout);
    };
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      console.error("Google login failed:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // ✅ Loading spinner
  const LoadingScreen = () => (
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        flexDirection: "column",
        gap: "12px",
        backgroundColor: "#f0fdf4"
      }}>
        <div style={{
          width: 48,
          height: 48,
          border: "5px solid #e5e7eb",
          borderTop: "5px solid #16a34a",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }} />
        <p style={{
          color: "#16a34a",
          fontWeight: "600",
          fontSize: "16px",
          margin: 0
        }}>
          Loading FarmIQ...
        </p>
      </div>
    </>
  );

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {loading ? <LoadingScreen /> : children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
