// src/context/AuthContext.jsx
// ─── Authentication context ───────────────────────────────────────────────────
// Extracts all Firebase auth management from App.jsx into a single place.
//
// Provides:
//   user              — resolved Firestore profile, or null
//   setUser           — manual override (used when App repairs role)
//   loading           — true while the initial auth state is being determined
//   pendingApproval   — true when a worker registered but admin hasn't approved yet
//   setPendingApproval
//   loginWithGoogle() — triggers signInWithRedirect (same-window, mobile-safe)
//   logout()          — signs out and clears the local cache

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  onAuthStateChanged,
  signOut,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  ensureUserProfile,
  isAdminEmail,
} from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Pre-load cached user so the app never flashes the login screen
  // when the user returns from the background.
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('farmiq_user_cache');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // true while Firebase is resolving the initial auth state
  const [loading, setLoading]               = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);

  useEffect(() => {
    // ── Handle Google Redirect ───────────────────────────────────────────────
    // Must be called on every page load. When the user returns from Google
    // sign-in (signInWithRedirect), this resolves the pending result BEFORE
    // onAuthStateChanged fires.  If there's no pending redirect, result.user
    // is null and we do nothing.
    getRedirectResult(auth)
      .then(async result => {
        if (result?.user) {
          // ensureUserProfile creates the Firestore document on first Google login.
          // onAuthStateChanged will fire automatically right after and call setUser.
          await ensureUserProfile(result.user);
        }
      })
      .catch(e => {
        // Swallow "auth/no-auth-event" — that's the normal case when there's no
        // pending redirect.  Log anything else for debugging.
        if (e?.code !== 'auth/no-auth-event') {
          console.warn('getRedirectResult error:', e?.code, e?.message);
        }
      });

    // ── Auth State Listener ──────────────────────────────────────────────────
    const unsubscribe = onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        try {
          const forceAdmin = isAdminEmail(fbUser.email);
          const profile    = await ensureUserProfile(fbUser);

          if (!profile) {
            // Profile couldn't be created/read — network error on very first login
            localStorage.removeItem('farmiq_user_cache');
            await signOut(auth);
            setUser(null);
            setLoading(false);
            return;
          }

          // ── Block removed workers ──────────────────────────────────────────
          // Soft-deleted workers can still authenticate but should be rejected here.
          if (!forceAdmin && profile.removed) {
            localStorage.removeItem('farmiq_user_cache');
            await signOut(auth);
            window.__workerRemoved = true;
            window.dispatchEvent(
              new CustomEvent('farmiq_auth_blocked', { detail: { reason: 'removed' } })
            );
            setUser(null);
            setLoading(false);
            return;
          }
          window.__workerRemoved = false;

          // ── Block unapproved workers ───────────────────────────────────────
          if (!profile.approved && !forceAdmin) {
            localStorage.removeItem('farmiq_user_cache');
            await signOut(auth);
            setPendingApproval(true);
            window.dispatchEvent(
              new CustomEvent('farmiq_auth_blocked', { detail: { reason: 'pending' } })
            );
            setUser(null);
            setLoading(false);
            return;
          }

          // ── Resolve final profile ──────────────────────────────────────────
          // Always force admin role on the admin email — never trust Firestore role alone.
          const resolvedRole    = forceAdmin ? 'admin' : (profile.role?.toLowerCase() || 'worker');
          const resolvedProfile = {
            ...profile,
            uid:      fbUser.uid,
            email:    fbUser.email,
            role:     resolvedRole,
            approved: forceAdmin ? true : (profile.approved || false),
          };

          try { localStorage.setItem('farmiq_user_cache', JSON.stringify(resolvedProfile)); }
          catch (e) { /* localStorage full */ }

          setUser(resolvedProfile);
        } catch (e) {
          console.error('Auth profile resolution error:', e);
          localStorage.removeItem('farmiq_user_cache');
          await signOut(auth);
          setUser(null);
        }
      } else {
        // Firebase confirmed signed out — clear everything
        localStorage.removeItem('farmiq_user_cache');
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ── Exposed actions ─────────────────────────────────────────────────────────

  /**
   * Trigger Google sign-in via redirect (not popup).
   * Redirect keeps everything in the same window/origin — popup opens as a new
   * tab on mobile Chrome and breaks Firebase sessionStorage across origins.
   */
  const loginWithGoogle = useCallback(async () => {
    await signInWithRedirect(auth, googleProvider);
    // Page navigates away — nothing runs after this line.
  }, []);

  /**
   * Sign out the current user and clear all local caches.
   */
  const logout = useCallback(async () => {
    try { localStorage.removeItem('farmiq_user_cache'); } catch (e) { /* */ }
    await signOut(auth);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        pendingApproval,
        setPendingApproval,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to consume auth context.
 * Must be used inside a component that is a descendant of <AuthProvider>.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
